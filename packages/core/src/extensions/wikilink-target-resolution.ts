import { defineCommands, definePlugin, union } from '@prosekit/core'
import { Plugin, PluginKey, type Command, type Transaction } from '@prosekit/pm/state'

interface PendingTargetResolution {
  readonly id: string
  readonly from: number
  readonly to: number
  readonly source: string
  readonly dirty: boolean
}

interface TargetResolutionState {
  readonly pending: ReadonlyMap<string, PendingTargetResolution>
}

type TargetResolutionMeta =
  | { readonly type: 'track'; readonly pending: PendingTargetResolution }
  | { readonly type: 'discard'; readonly id: string }

const targetResolutionKey = new PluginKey<TargetResolutionState>('meowdownWikilinkTargetResolution')

function applyMeta(
  meta: TargetResolutionMeta,
  value: TargetResolutionState,
): TargetResolutionState {
  const pending = new Map(value.pending)
  switch (meta.type) {
    case 'track':
      pending.set(meta.pending.id, meta.pending)
      break
    case 'discard':
      pending.delete(meta.id)
      break
  }
  return { pending }
}

function mapPending(transaction: Transaction, value: TargetResolutionState): TargetResolutionState {
  const pending = new Map<string, PendingTargetResolution>()
  for (const resolution of value.pending.values()) {
    const fromResult = transaction.mapping.mapResult(resolution.from, 1)
    const toResult = transaction.mapping.mapResult(resolution.to, -1)
    const from = Math.min(fromResult.pos, toResult.pos)
    const to = Math.max(fromResult.pos, toResult.pos)
    const sourceGone = (fromResult.deletedAfter && toResult.deletedBefore) || from >= to
    if (sourceGone) continue
    pending.set(resolution.id, {
      ...resolution,
      from,
      to,
      dirty: resolution.dirty || transaction.doc.textBetween(from, to) !== resolution.source,
    })
  }
  return { pending }
}

const targetResolutionPlugin = new Plugin<TargetResolutionState>({
  key: targetResolutionKey,
  state: {
    init: () => ({ pending: new Map() }),
    apply: (transaction, value) => {
      const meta = transaction.getMeta(targetResolutionKey) as TargetResolutionMeta | undefined
      const nextValue = meta ? applyMeta(meta, value) : value
      if (transaction.docChanged && nextValue.pending.size > 0) {
        return mapPending(transaction, nextValue)
      }
      return nextValue
    },
  },
})

/** Identifies a provisional wikilink range to follow while its target resolves. */
export interface TrackWikilinkTargetResolutionOptions {
  /** Unique identifier shared with the settle or discard command. */
  readonly id: string
  /** Inclusive start of the inserted wikilink in the ProseMirror document. */
  readonly from: number
  /** Exclusive end of the inserted wikilink in the ProseMirror document. */
  readonly to: number
  /** Exact text expected inside the tracked range. */
  readonly source: string
}

function trackWikilinkTargetResolution(options: TrackWikilinkTargetResolutionOptions): Command {
  return (state, dispatch) => {
    const { id, from, to, source } = options
    if (
      id === '' ||
      from < 0 ||
      from >= to ||
      to > state.doc.content.size ||
      state.doc.textBetween(from, to) !== source
    ) {
      return false
    }
    dispatch?.(
      state.tr.setMeta(targetResolutionKey, {
        type: 'track',
        pending: { id, from, to, source, dirty: false },
      } satisfies TargetResolutionMeta),
    )
    return true
  }
}

/** Supplies the final result for a tracked provisional wikilink. */
export interface SettleWikilinkTargetResolutionOptions {
  /** Identifier passed when the provisional range was tracked. */
  readonly id: string
  /** Final wikilink target, or null to remove the provisional link. */
  readonly target: string | null
}

function settleWikilinkTargetResolution(options: SettleWikilinkTargetResolutionOptions): Command {
  return (state, dispatch) => {
    const resolution = targetResolutionKey.getState(state)?.pending.get(options.id)
    if (!resolution) return false
    if (dispatch) {
      const transaction = state.tr
        .setMeta(targetResolutionKey, {
          type: 'discard',
          id: options.id,
        } satisfies TargetResolutionMeta)
        .setMeta('addToHistory', false)
      const currentSource = state.doc.textBetween(resolution.from, resolution.to)
      if (!resolution.dirty && currentSource === resolution.source) {
        if (options.target === null) {
          transaction.delete(resolution.from, resolution.to)
        } else {
          const source = `[[${options.target}]]`
          if (source !== currentSource) {
            transaction.insertText(source, resolution.from, resolution.to)
          }
        }
      }
      dispatch(transaction)
    }
    return true
  }
}

function discardWikilinkTargetResolution(id: string): Command {
  return (state, dispatch) => {
    if (!targetResolutionKey.getState(state)?.pending.has(id)) return false
    dispatch?.(
      state.tr.setMeta(targetResolutionKey, {
        type: 'discard',
        id,
      } satisfies TargetResolutionMeta),
    )
    return true
  }
}

/**
 * Tracks provisional wikilinks while a host resolves their final targets.
 * Ranges map through unrelated edits; an edited or deleted provisional link
 * is never overwritten when the asynchronous answer arrives.
 */
export function defineWikilinkTargetResolution() {
  return union(
    definePlugin(targetResolutionPlugin),
    defineCommands({
      trackWikilinkTargetResolution,
      settleWikilinkTargetResolution,
      discardWikilinkTargetResolution,
    }),
  )
}
