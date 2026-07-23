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
import type { EditorView } from '@prosekit/pm/view'

import type { PositionRange } from '../utils/range.ts'

import { BatchSetMarkStep } from './batch-set-mark-step.ts'
import { inlineTextToMarkChunks, type InlineMarkOptions } from './inline-text-to-mark-chunks.ts'
import type { MarkChunk } from './mark-chunk.ts'
import { isNodeOfType } from './node-names.ts'
import {
  buildReferenceIndex,
  cachedDefinitionParse,
  EMPTY_REFERENCE_INDEX,
  transactionTouchesDefinitions,
  type ReferenceDefinition,
  type ReferenceDefinitionCache,
  type ReferenceIndex,
} from './reference-links.ts'
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

interface InlineMarkPluginState {
  readonly references: ReferenceIndex
  /** The definition set changed and untouched citing blocks may be stale. */
  readonly restyleNeeded: boolean
}

const inlineMarkPluginKey = new PluginKey<InlineMarkPluginState>('inline-mark')

const RESTYLE_KEY = 'inline-marks-restyle'

/** Quiet period after the last definition edit before the restyle flushes. */
const RESTYLE_DEBOUNCE_MS = 200

/** @internal only for test */
export function flushPendingRestyle(view: EditorView): void {
  if (inlineMarkPluginKey.getState(view.state)?.restyleNeeded === true) {
    view.dispatch(view.state.tr.setMeta(RESTYLE_KEY, true))
  }
}

function createInlineMarkPlugin(options: InlineMarkOptions | undefined): Plugin {
  /** Definition parse results per paragraph node identity. */
  const definitionCache: ReferenceDefinitionCache = new WeakMap()

  /**
   * Cache of chunks per textblock node, keyed by the immutable
   * `ProseMirrorNode` instance. Stored chunks are baseOffset-relative
   * (i.e. positions are offsets into the node's text, not absolute doc
   * positions) so an entry stays valid when the same node moves around
   * the doc (a paragraph below it was inserted or deleted). Scoped to the
   * plugin instance because the chunks depend on this editor's `options`.
   */
  interface CachedChunks {
    readonly chunks: readonly MarkChunk[]
    /** Reference keys this block looked up and what each resolved to. */
    readonly resolved: ReadonlyMap<string, ReferenceDefinition | null> | undefined
    readonly isDefinition: boolean
  }

  const chunkCache = new WeakMap<EditorNode, CachedChunks>()

  function cacheValid(
    entry: CachedChunks,
    references: ReferenceIndex,
    isDefinition: boolean,
  ): boolean {
    if (entry.isDefinition !== isDefinition) return false
    if (entry.resolved === undefined) return true
    for (const [key, definition] of entry.resolved) {
      const current = references.definitions.get(key) ?? null
      if (current === definition) continue
      if (
        current === null ||
        definition === null ||
        current.href !== definition.href ||
        current.title !== definition.title
      ) {
        return false
      }
    }
    return true
  }

  function chunksForTextblock(
    node: EditorNode,
    baseOffset: number,
    schema: Schema,
    references: ReferenceIndex,
    isDefinition: boolean,
  ): readonly MarkChunk[] {
    const cached = chunkCache.get(node)
    let relative: readonly MarkChunk[]
    if (cached !== undefined && cacheValid(cached, references, isDefinition)) {
      chunkCacheHits++
      relative = cached.chunks
    } else {
      chunkCacheParses++
      const usedReferences = new Map<string, ReferenceDefinition | null>()
      relative = inlineTextToMarkChunks(getMarkBuildersForSchema(schema), node.textContent, {
        ...options,
        referenceDefinitions: references.definitions,
        isReferenceDefinition: isDefinition,
        usedReferences,
      })
      chunkCache.set(node, {
        chunks: relative,
        resolved: usedReferences.size > 0 ? usedReferences : undefined,
        isDefinition,
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
   *
   * With `coverWholeDoc` the walk spans the whole document, but blocks
   * outside `editedRange` whose cached chunks still match the current
   * definitions are skipped without re-parsing or emitting.
   */
  function collectChunksForRange(
    state: EditorState,
    editedRange: PositionRange,
    references: ReferenceIndex,
    coverWholeDoc: boolean,
  ): MarkChunk[] {
    const chunks: MarkChunk[] = []
    const doc = state.doc
    const scanFrom = coverWholeDoc ? 0 : editedRange.from
    const scanTo = coverWholeDoc ? doc.content.size : editedRange.to
    doc.nodesBetween(scanFrom, scanTo, (node, pos, parent) => {
      if (node.type.spec.code) return false
      if (!node.isTextblock) return true
      if (node.childCount === 0) return false
      const isDefinition =
        parent === doc &&
        isNodeOfType(node, 'paragraph') &&
        cachedDefinitionParse(node, definitionCache) !== null
      if (coverWholeDoc && (pos + node.nodeSize <= editedRange.from || pos + 1 > editedRange.to)) {
        const cached = chunkCache.get(node)
        if (cached !== undefined && cacheValid(cached, references, isDefinition)) return false
      }
      const nodeChunks = chunksForTextblock(node, pos + 1, state.schema, references, isDefinition)
      if (nodeChunks.length > 0) chunks.push(...nodeChunks)
      return false
    })
    return chunks
  }

  return new Plugin<InlineMarkPluginState>({
    key: inlineMarkPluginKey,
    state: {
      init(_config, state) {
        return { references: buildReferenceIndex(state.doc, definitionCache), restyleNeeded: false }
      },
      apply(transaction, value) {
        if (transaction.getMeta(RESTYLE_KEY) === true) {
          return value.restyleNeeded
            ? { references: value.references, restyleNeeded: false }
            : value
        }
        // Our own appended step only rewrites marks, never block text.
        if (!transaction.docChanged || transaction.getMeta(META_KEY)) return value
        if (!transactionTouchesDefinitions(transaction, definitionCache)) return value
        const next = buildReferenceIndex(transaction.doc, definitionCache, value.references)
        if (next === value.references) return value
        return { references: next, restyleNeeded: true }
      },
    },
    appendTransaction(transactions, _oldState, newState) {
      // Drop transactions we appended ourselves to avoid recursing.
      for (const tr of transactions) {
        if (tr.getMeta(META_KEY)) return null
      }
      const pluginState = inlineMarkPluginKey.getState(newState)
      const references = pluginState?.references ?? EMPTY_REFERENCE_INDEX
      const restyle = transactions.some((tr) => tr.getMeta(RESTYLE_KEY) === true)
      // The flush walks the whole doc with an empty edited range, so only
      // blocks whose cached chunks went stale are re-parsed and re-marked.
      const editedRange = restyle
        ? { from: 0, to: 0 }
        : computeAffectedRange(transactions, newState)
      const chunks = collectChunksForRange(newState, editedRange, references, restyle)
      if (chunks.length === 0) return null
      const tr = newState.tr.step(new BatchSetMarkStep(chunks))
      tr.setMeta(META_KEY, true)
      tr.setMeta('addToHistory', false)
      return tr
    },
    view(editorView) {
      // `EditorState.create` does NOT fire `appendTransaction`, so the
      // initial document never gets processed via the normal path. Dispatch
      // a no-op tr on mount to wake the plugin up.
      editorView.dispatch(triggerInlineMarks(editorView.state))

      let timer: ReturnType<typeof setTimeout> | undefined

      const flush = (view: EditorView): void => {
        timer = undefined
        if (view.isDestroyed) return
        if (inlineMarkPluginKey.getState(view.state)?.restyleNeeded !== true) return
        view.dispatch(view.state.tr.setMeta(RESTYLE_KEY, true))
      }

      return {
        update(view, prevState) {
          const current = inlineMarkPluginKey.getState(view.state)
          if (current?.restyleNeeded !== true) {
            if (timer !== undefined) clearTimeout(timer)
            timer = undefined
            return
          }
          // Plugin-state identity changes exactly when the definition set
          // changed, so unrelated edits and selection moves leave the
          // pending timer alone instead of pushing the flush out.
          if (timer === undefined || inlineMarkPluginKey.getState(prevState) !== current) {
            if (timer !== undefined) clearTimeout(timer)
            timer = setTimeout(() => flush(view), RESTYLE_DEBOUNCE_MS)
          }
        },
        destroy() {
          if (timer !== undefined) clearTimeout(timer)
        },
      }
    },
  })
}

function triggerInlineMarks(state: EditorState): Transaction {
  return state.tr.setMeta('inline-marks-trigger', true)
}

export function defineInlineMarkPlugin(options?: InlineMarkOptions) {
  return definePlugin(createInlineMarkPlugin(options))
}
