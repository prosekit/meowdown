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
import {
  inlineTextToMarkChunksWithContext,
  type InlineMarkOptions,
} from './inline-text-to-mark-chunks.ts'
import type { MarkChunk } from './mark-chunk.ts'
import {
  collectReferenceDefinitions,
  isReferenceDefinitionNode,
  updateReferenceDefinitions,
  type ReferenceDefinition,
  type ReferenceDefinitionIndex,
  type ReferenceDefinitions,
} from './reference-links.ts'
import { getMarkBuildersForSchema } from './schema.ts'

const META_KEY = 'inline-marks-applied'
const TRIGGER_KEY = 'inline-marks-trigger'
const RESTYLE_KEY = 'inline-marks-restyle'
const RESTYLE_DEBOUNCE_MS = 200

interface InlineMarkPluginState {
  readonly references: ReferenceDefinitionIndex
  readonly pendingReferenceKeys: ReadonlySet<string>
}

const pluginKey = new PluginKey<InlineMarkPluginState>('inline-mark')
const emptyReferenceKeys: ReadonlySet<string> = new Set()

/** @internal only for test */
export function flushPendingRestyle(view: EditorView): void {
  if ((pluginKey.getState(view.state)?.pendingReferenceKeys.size ?? 0) > 0) {
    view.dispatch(view.state.tr.setMeta(RESTYLE_KEY, true))
  }
}

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
    readonly isReferenceDefinition: boolean
    readonly referencedKeys: ReadonlySet<string>
    readonly chunks: readonly MarkChunk[]
  }

  const chunkCache = new WeakMap<EditorNode, CachedChunks>()

  function setsIntersect(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
    for (const value of left) {
      if (right.has(value)) return true
    }
    return false
  }

  function shiftChunks(chunks: readonly MarkChunk[], offset: number): MarkChunk[] {
    const shifted: MarkChunk[] = []
    for (const [from, to, marks] of chunks) {
      shifted.push([from + offset, to + offset, marks])
    }
    return shifted
  }

  function chunksForTextblock(
    node: EditorNode,
    baseOffset: number,
    schema: Schema,
    references: ReferenceDefinitionIndex,
    changedKeys: ReadonlySet<string>,
    isReferenceDefinition: boolean,
  ): readonly MarkChunk[] {
    const cached = chunkCache.get(node)
    let relative: readonly MarkChunk[]

    if (
      cached?.isReferenceDefinition === isReferenceDefinition &&
      !setsIntersect(cached.referencedKeys, changedKeys)
    ) {
      chunkCacheHits++
      relative = cached.chunks
    } else {
      chunkCacheParses++
      const referencedKeys = new Set<string>()
      relative = inlineTextToMarkChunksWithContext(
        getMarkBuildersForSchema(schema),
        node.textContent,
        options,
        {
          referenceDefinitions: references.definitions,
          isReferenceDefinition,
          referencedKeys,
        },
      )
      chunkCache.set(node, { isReferenceDefinition, referencedKeys, chunks: relative })
    }
    if (baseOffset === 0) return relative
    return shiftChunks(relative, baseOffset)
  }

  /**
   * Walk a doc range and collect mark chunks for every participating
   * textblock encountered.
   *
   * The walker uses `nodesBetween` which naturally recurses into
   * containers (blockquote, list, tableCell), so it picks up nested
   * textblocks without each container needing to be listed explicitly.
   */
  function collectChunks(
    state: EditorState,
    range: PositionRange,
    references: ReferenceDefinitionIndex,
    changedKeys: ReadonlySet<string>,
  ): {
    chunks: MarkChunk[]
    processed: { position: number; cached: CachedChunks }[]
  } {
    const chunks: MarkChunk[] = []
    const processed: { position: number; cached: CachedChunks }[] = []
    const visit = (
      node: EditorNode,
      pos: number,
      parent: EditorNode | null,
      index: number,
    ): boolean => {
      if (node.type.spec.code) return false
      if (!node.isTextblock) return true
      if (node.childCount === 0) return false

      const cached = chunkCache.get(node)
      const touchesRange = pos <= range.to && pos + node.nodeSize >= range.from
      const dependsOnChange = cached == null || setsIntersect(cached.referencedKeys, changedKeys)
      if (!touchesRange && !dependsOnChange) return false

      const nodeChunks = chunksForTextblock(
        node,
        pos + 1,
        state.schema,
        references,
        changedKeys,
        isReferenceDefinitionNode(node, parent, index),
      )
      if (nodeChunks.length > 0) chunks.push(...nodeChunks)
      const updated = chunkCache.get(node)
      if (updated != null) processed.push({ position: pos, cached: updated })
      return false
    }

    if (changedKeys.size === 0) {
      state.doc.nodesBetween(range.from, range.to, visit)
    } else {
      state.doc.descendants(visit)
    }
    return { chunks, processed }
  }

  function transferCache(
    doc: EditorNode,
    processed: readonly { position: number; cached: CachedChunks }[],
  ): void {
    for (const { position, cached } of processed) {
      const node = doc.nodeAt(position)
      if (node?.isTextblock) chunkCache.set(node, cached)
    }
  }

  return new Plugin<InlineMarkPluginState>({
    key: pluginKey,
    state: {
      init(_config, state) {
        return {
          references: collectReferenceDefinitions(state.doc),
          pendingReferenceKeys: emptyReferenceKeys,
        }
      },
      apply(transaction, value, _oldState, newState) {
        if (transaction.getMeta(RESTYLE_KEY) === true) {
          return value.pendingReferenceKeys.size === 0
            ? value
            : { references: value.references, pendingReferenceKeys: emptyReferenceKeys }
        }
        if (transaction.getMeta(META_KEY)) return value
        const references = updateReferenceDefinitions(value.references, transaction, newState.doc)
        if (references === value.references) return value
        const changedKeys = getChangedReferenceKeys(
          value.references.definitions,
          references.definitions,
        )
        if (changedKeys.size === 0) {
          return { references, pendingReferenceKeys: value.pendingReferenceKeys }
        }
        return {
          references,
          pendingReferenceKeys: mergeReferenceKeys(value.pendingReferenceKeys, changedKeys),
        }
      },
    },
    appendTransaction(transactions, oldState, newState) {
      // Drop transactions we appended ourselves to avoid recursing.
      for (const tr of transactions) {
        if (tr.getMeta(META_KEY)) return null
      }

      const restyle = transactions.some((transaction) => transaction.getMeta(RESTYLE_KEY))
      const shouldProcess =
        restyle ||
        transactions.some((transaction) => {
          return transaction.docChanged || transaction.getMeta(TRIGGER_KEY)
        })
      if (!shouldProcess) return null

      const references = pluginKey.getState(newState)?.references
      if (references == null) return null
      const changedKeys = restyle
        ? (pluginKey.getState(oldState)?.pendingReferenceKeys ?? emptyReferenceKeys)
        : emptyReferenceKeys
      const range = restyle ? { from: 0, to: 0 } : computeAffectedRange(transactions, newState)
      const { chunks, processed } = collectChunks(newState, range, references, changedKeys)
      if (chunks.length === 0) return null
      const tr = newState.tr.step(new BatchSetMarkStep(chunks))
      transferCache(tr.doc, processed)
      tr.setMeta(META_KEY, true)
      tr.setMeta('addToHistory', false)
      return tr
    },
    view(view) {
      // `EditorState.create` does NOT fire `appendTransaction`, so the
      // initial document never gets processed via the normal path. Dispatch
      // a no-op tr on mount to wake the plugin up.
      view.dispatch(triggerInlineMarks(view.state))

      let timer: ReturnType<typeof setTimeout> | undefined

      const flush = (currentView: EditorView): void => {
        timer = undefined
        if (currentView.isDestroyed) return
        if ((pluginKey.getState(currentView.state)?.pendingReferenceKeys.size ?? 0) === 0) return
        currentView.dispatch(currentView.state.tr.setMeta(RESTYLE_KEY, true))
      }

      return {
        update(currentView, previousState) {
          const current = pluginKey.getState(currentView.state)
          if ((current?.pendingReferenceKeys.size ?? 0) === 0) {
            if (timer != null) clearTimeout(timer)
            timer = undefined
            return
          }
          if (timer == null || pluginKey.getState(previousState) !== current) {
            if (timer != null) clearTimeout(timer)
            timer = setTimeout(() => flush(currentView), RESTYLE_DEBOUNCE_MS)
          }
        },
        destroy() {
          if (timer != null) clearTimeout(timer)
        },
      }
    },
  })
}

function triggerInlineMarks(state: EditorState): Transaction {
  return state.tr.setMeta(TRIGGER_KEY, true)
}

function definitionsEqual(
  left: ReferenceDefinition | undefined,
  right: ReferenceDefinition | undefined,
): boolean {
  return left?.href === right?.href && left?.title === right?.title
}

function getChangedReferenceKeys(
  previous: ReferenceDefinitions | undefined,
  current: ReferenceDefinitions,
): ReadonlySet<string> {
  if (previous == null) return new Set(current.keys())

  const changed = new Set<string>()
  for (const [key, definition] of previous) {
    if (!definitionsEqual(definition, current.get(key))) changed.add(key)
  }
  for (const [key, definition] of current) {
    if (!definitionsEqual(definition, previous.get(key))) changed.add(key)
  }
  return changed
}

function mergeReferenceKeys(
  previous: ReadonlySet<string>,
  current: ReadonlySet<string>,
): ReadonlySet<string> {
  if (previous.size === 0) return current
  const merged = new Set(previous)
  for (const key of current) merged.add(key)
  return merged
}

export function defineInlineMarkPlugin(options?: InlineMarkOptions) {
  return definePlugin(createInlineMarkPlugin(options))
}
