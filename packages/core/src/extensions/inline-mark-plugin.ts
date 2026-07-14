/**
 * Inline-mark plugin
 *
 * Pipeline per dispatched transaction:
 *
 *   appendTransaction(transactions, oldState, newState)
 *     -> bail if any source transaction came from us (META_KEY)
 *     -> compute affected range from step maps (fall back to full doc)
 *     -> walk participating textblocks (paragraph / heading etc.) inside that range
 *     -> for each: text = node.textContent
 *                  chunks = inlineTextToMarkChunks(getMarkBuildersForSchema(schema), text)
 *     -> if chunks is non-empty: tr.step(new BatchSetMarkStep(chunks))
 *                                  .setMeta(META_KEY, true)
 */

import { definePlugin } from '@prosekit/core'
import type { EditorNode, Schema } from '@prosekit/pm/model'
import type { EditorState, Transaction } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'

import type { PositionRange } from '../utils/range.ts'

import { BatchSetMarkStep } from './batch-set-mark-step.ts'
import { inlineTextToMarkChunks, type InlineMarkOptions } from './inline-text-to-mark-chunks.ts'
import type { MarkChunk } from './mark-chunk.ts'
import { collectReferenceDefinitions, type ReferenceDefinitionIndex } from './reference-links.ts'
import { getMarkBuildersForSchema } from './schema.ts'

const META_KEY = 'inline-marks-applied'

/**
 * Test instrumentation: `chunkCacheParses` / `chunkCacheHits` count
 * parses we did and parses we avoided. Exposed via `getCacheStats` /
 * `resetCacheStats` for spy tests; never read in production code.
 */
let chunkCacheParses = 0
let chunkCacheHits = 0

/** @internal only for test */
export function resetCacheStats(): void {
  chunkCacheParses = 0
  chunkCacheHits = 0
}

/** @internal only for test */
export function getCacheStats(): { parses: number; hits: number } {
  return { parses: chunkCacheParses, hits: chunkCacheHits }
}

/**
 * Compute the union of all position ranges touched by the given
 * transactions, mapped into `newState.doc`'s coordinate space.
 *
 * Returns the full doc range when no ranges are available (e.g. an
 * inert / no-op transaction used to wake the plugin up).
 */
function computeAffectedRange(
  transactions: readonly Transaction[],
  newState: EditorState,
): PositionRange {
  let from = Infinity
  let to = -Infinity
  for (const tr of transactions) {
    for (const map of tr.mapping.maps) {
      map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
        if (newStart < from) from = newStart
        if (newEnd > to) to = newEnd
      })
    }
  }
  const docSize = newState.doc.content.size
  if (from > to) {
    return { from: 0, to: docSize }
  }
  return {
    from: Math.max(0, from),
    to: Math.min(docSize, to),
  }
}

function createInlineMarkPlugin(options: InlineMarkOptions | undefined): Plugin {
  /**
   * Cache of chunks per textblock node, keyed by the immutable
   * `ProseMirrorNode` instance. Stored chunks are baseOffset-relative
   * (i.e. positions are offsets into the node's text, not absolute doc
   * positions) so an entry stays valid when the same node moves around
   * the doc (a paragraph below it was inserted or deleted). Scoped to the
   * plugin instance because the chunks depend on this editor's `options`.
   */
  interface CachedChunks {
    readonly referenceSignature: string
    readonly chunks: readonly MarkChunk[]
  }

  const chunkCache = new WeakMap<EditorNode, CachedChunks>()
  let lastReferenceSignature: string | undefined

  function chunksForTextblock(
    node: EditorNode,
    baseOffset: number,
    schema: Schema,
    references: ReferenceDefinitionIndex,
  ): readonly MarkChunk[] {
    const cached = chunkCache.get(node)
    let relative: readonly MarkChunk[]
    if (cached?.referenceSignature === references.signature) {
      chunkCacheHits++
      relative = cached.chunks
    } else {
      chunkCacheParses++
      relative = inlineTextToMarkChunks(
        getMarkBuildersForSchema(schema),
        node.textContent,
        options,
        { referenceDefinitions: references.definitions },
      )
      chunkCache.set(node, {
        referenceSignature: references.signature,
        chunks: relative,
      })
    }
    if (baseOffset === 0) return relative
    const shifted: MarkChunk[] = []
    for (const [from, to, marks] of relative) {
      shifted.push([from + baseOffset, to + baseOffset, marks])
    }
    return shifted
  }

  /**
   * Walk a doc range and collect mark chunks for every participating
   * textblock encountered.
   *
   * The walker uses `nodesBetween` which naturally recurses into
   * containers (blockquote, list, tableCell), so it picks up nested
   * textblocks without each container needing to be listed explicitly.
   */
  function collectChunksForRange(
    state: EditorState,
    range: PositionRange,
    references: ReferenceDefinitionIndex,
  ): MarkChunk[] {
    const chunks: MarkChunk[] = []
    state.doc.nodesBetween(range.from, range.to, (node, pos) => {
      if (node.type.spec.code) return false
      if (!node.isTextblock) return true
      if (node.childCount === 0) return false
      const nodeChunks = chunksForTextblock(node, pos + 1, state.schema, references)
      if (nodeChunks.length > 0) chunks.push(...nodeChunks)
      return false
    })
    return chunks
  }

  return new Plugin({
    key: new PluginKey('inline-mark'),
    appendTransaction(transactions, _oldState, newState) {
      // Drop transactions we appended ourselves to avoid recursing.
      for (const tr of transactions) {
        if (tr.getMeta(META_KEY)) return null
      }
      const references = collectReferenceDefinitions(newState.doc)
      const definitionsChanged = lastReferenceSignature !== references.signature
      lastReferenceSignature = references.signature
      const range = definitionsChanged
        ? { from: 0, to: newState.doc.content.size }
        : computeAffectedRange(transactions, newState)
      const chunks = collectChunksForRange(newState, range, references)
      if (chunks.length === 0) return null
      const tr = newState.tr.step(new BatchSetMarkStep(chunks))
      tr.setMeta(META_KEY, true)
      tr.setMeta('addToHistory', false)
      return tr
    },
    view(view) {
      // `EditorState.create` does NOT fire `appendTransaction`, so the
      // initial document never gets processed via the normal path. Dispatch
      // a no-op tr on mount to wake the plugin up.
      view.dispatch(triggerInlineMarks(view.state))
      return {}
    },
  })
}

function triggerInlineMarks(state: EditorState): Transaction {
  return state.tr.setMeta('inline-marks-trigger', true)
}

export function defineInlineMarkPlugin(options?: InlineMarkOptions) {
  return definePlugin(createInlineMarkPlugin(options))
}
