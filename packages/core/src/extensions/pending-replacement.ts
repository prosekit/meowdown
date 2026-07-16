import {
  defineCommands,
  defineKeymap,
  definePlugin,
  union,
  type PlainExtension,
} from '@prosekit/core'
import { Slice } from '@prosekit/pm/model'
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
} from '@prosekit/pm/state'
import { Decoration, DecorationSet } from '@prosekit/pm/view'

import { markdownToDoc } from '../converters/md-to-pm.ts'
import type { PositionRange } from '../utils/range.ts'

import { isNodeOfType } from './node-names.ts'
import { getNodeBuildersForSchema } from './schema.ts'

/** Where an accepted replacement lands relative to the source range. */
export type PendingReplacementMode = 'replace' | 'append'

/** How a pending replacement ended. */
export type PendingReplacementOutcome = 'accepted' | 'discarded'

/**
 * A staged replacement: Markdown text accumulating over `[from, to]` that is
 * only written into the document when accepted. Until then the document is
 * untouched; discarding is a no-op.
 */
export interface PendingReplacement {
  /** Start of the source range the replacement targets. */
  from: number
  /** End of the source range the replacement targets. */
  to: number
  /** The Markdown accumulated so far (e.g. streamed from an AI provider). */
  text: string
  /** Whether accepting replaces the source range or inserts after its block. */
  mode: PendingReplacementMode
}

interface PendingReplacementPluginState {
  pending: PendingReplacement | null
  /**
   * The replacement that just ended and how, present only on the state
   * produced by the transaction that ended it. Lets watchers distinguish an
   * accept from a discard without re-deriving it from the document.
   */
  ended?: { pending: PendingReplacement; outcome: PendingReplacementOutcome }
}

type PendingReplacementMeta =
  | { type: 'start'; from: number; to: number; mode: PendingReplacementMode }
  | { type: 'append'; text: string }
  | { type: 'accept' }
  | { type: 'discard' }

const pendingReplacementKey = new PluginKey<PendingReplacementPluginState>(
  'meowdownPendingReplacement',
)

/** The active pending replacement, or null when there is none. */
export function getPendingReplacement(state: EditorState): PendingReplacement | null {
  return pendingReplacementKey.getState(state)?.pending ?? null
}

function applyMeta(
  meta: PendingReplacementMeta,
  value: PendingReplacementPluginState,
): PendingReplacementPluginState {
  switch (meta.type) {
    case 'start':
      return { pending: { from: meta.from, to: meta.to, mode: meta.mode, text: '' } }
    case 'append':
      if (!value.pending) return value
      return { pending: { ...value.pending, text: value.pending.text + meta.text } }
    case 'accept':
      if (!value.pending) return value
      return { pending: null, ended: { pending: value.pending, outcome: 'accepted' } }
    case 'discard':
      if (!value.pending) return value
      return { pending: null, ended: { pending: value.pending, outcome: 'discarded' } }
  }
}

const pendingReplacementPlugin = new Plugin<PendingReplacementPluginState>({
  key: pendingReplacementKey,
  state: {
    init: () => ({ pending: null }),
    apply: (tr, value) => {
      const meta = tr.getMeta(pendingReplacementKey) as PendingReplacementMeta | undefined
      if (meta) return applyMeta(meta, value)
      // Other document changes (typing, mark re-derivation) remap the staged
      // range. Insertions at the edges stay outside the range; a replace stage
      // whose source content is deleted or collapsed away is discarded.
      if (tr.docChanged && value.pending) {
        const fromResult = tr.mapping.mapResult(value.pending.from, 1)
        const toResult = tr.mapping.mapResult(value.pending.to, -1)
        const from = Math.min(fromResult.pos, toResult.pos)
        const to = Math.max(fromResult.pos, toResult.pos)
        const sourceGone = (fromResult.deletedAfter && toResult.deletedBefore) || from >= to
        if (sourceGone && value.pending.mode === 'replace') {
          return { pending: null, ended: { pending: value.pending, outcome: 'discarded' } }
        }
        return { pending: { ...value.pending, from, to } }
      }
      return value
    },
  },
  props: {
    decorations: (state) => {
      const pending = getPendingReplacement(state)
      if (!pending || pending.from >= pending.to) return null
      return DecorationSet.create(state.doc, [
        Decoration.inline(pending.from, pending.to, { class: 'md-pending-replacement' }),
      ])
    },
  },
})

/** Options for the `startPendingReplacement` command. */
export interface StartPendingReplacementOptions extends PositionRange {
  mode: PendingReplacementMode
}

function startPendingReplacement(options: StartPendingReplacementOptions): Command {
  return (state, dispatch) => {
    const { from, to, mode } = options
    if (from < 0 || to > state.doc.content.size || from > to) return false
    if (from === to && mode === 'replace') return false
    dispatch?.(
      state.tr.setMeta(pendingReplacementKey, {
        type: 'start',
        from,
        to,
        mode,
      } satisfies PendingReplacementMeta),
    )
    return true
  }
}

function appendPendingReplacementText(text: string): Command {
  return (state, dispatch) => {
    if (!getPendingReplacement(state)) return false
    dispatch?.(
      state.tr.setMeta(pendingReplacementKey, {
        type: 'append',
        text,
      } satisfies PendingReplacementMeta),
    )
    return true
  }
}

function discardPendingReplacement(): Command {
  return (state, dispatch) => {
    if (!getPendingReplacement(state)) return false
    dispatch?.(
      state.tr.setMeta(pendingReplacementKey, { type: 'discard' } satisfies PendingReplacementMeta),
    )
    return true
  }
}

/** Options for the `acceptPendingReplacement` command. */
export interface AcceptPendingReplacementOptions {
  /** Overrides the staged mode for this accept (e.g. "Insert below" on a replace stage). */
  mode?: PendingReplacementMode
}

function acceptPendingReplacement(options: AcceptPendingReplacementOptions = {}): Command {
  return (state, dispatch) => {
    const pending = getPendingReplacement(state)
    if (!pending || !pending.text.trim()) return false
    if (dispatch) {
      const mode = options.mode ?? pending.mode
      const nodes = getNodeBuildersForSchema(state.schema)
      const parsed = markdownToDoc(pending.text, { nodes })
      const tr = state.tr
      tr.setMeta(pendingReplacementKey, { type: 'accept' } satisfies PendingReplacementMeta)

      if (mode === 'append') {
        // Insert the parsed blocks after the top-level block containing `to`.
        const insertPos = state.doc.resolve(pending.to).after(1)
        tr.insert(insertPos, parsed.content)
        tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + parsed.content.size), -1))
      } else {
        const $from = state.doc.resolve(pending.from)
        const $to = state.doc.resolve(pending.to)
        const paragraph = parsed.childCount === 1 ? parsed.firstChild : null
        if (
          paragraph != null &&
          isNodeOfType(paragraph, 'paragraph') &&
          $from.sameParent($to) &&
          $from.parent.isTextblock
        ) {
          // A single-paragraph result inside one textblock stays inline, so a
          // sentence-level fix does not split the surrounding paragraph.
          tr.replaceWith(pending.from, pending.to, paragraph.content)
          tr.setSelection(
            TextSelection.near(tr.doc.resolve(pending.from + paragraph.content.size), -1),
          )
        } else {
          tr.replaceRange(pending.from, pending.to, new Slice(parsed.content, 0, 0))
          tr.setSelection(TextSelection.near(tr.doc.resolve(tr.mapping.map(pending.to)), -1))
        }
      }
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

function definePendingReplacementCommands() {
  return defineCommands({
    startPendingReplacement,
    appendPendingReplacementText,
    acceptPendingReplacement,
    discardPendingReplacement,
  })
}

/** Accept on Mod-Enter and discard on Escape, only while a replacement is pending. */
function definePendingReplacementKeymap(): PlainExtension {
  return defineKeymap({
    'Mod-Enter': acceptPendingReplacement(),
    Escape: discardPendingReplacement(),
  })
}

/**
 * The pending-replacement primitive: staged Markdown over a source range,
 * previewed without touching the document. `startPendingReplacement` stages a
 * range (restarting resets the accumulated text, which is how a retry begins),
 * `appendPendingReplacementText` accumulates streamed text,
 * `acceptPendingReplacement` applies the result as one transaction — inline
 * when a single-paragraph result lands inside one textblock, as blocks
 * otherwise — and `discardPendingReplacement` clears the stage without a
 * document change. Other edits remap the staged range; a replace stage whose
 * source range is deleted is discarded.
 */
export function definePendingReplacement() {
  return union(
    definePlugin(pendingReplacementPlugin),
    definePendingReplacementCommands(),
    definePendingReplacementKeymap(),
  )
}

/** A pending-replacement change: text/range updates, or how the stage ended. */
export type PendingReplacementEvent =
  | { type: 'update'; pending: PendingReplacement }
  | { type: 'ended'; pending: PendingReplacement; outcome: PendingReplacementOutcome }

export type PendingReplacementHandler = (event: PendingReplacementEvent) => void

/**
 * Watches pending-replacement state and reports changes, so a UI layer can
 * render the preview and know whether the stage was accepted or discarded.
 */
export function definePendingReplacementHandler(
  handler: PendingReplacementHandler,
): PlainExtension {
  return definePlugin(
    new Plugin({
      view: () => ({
        update: (view, prevState) => {
          const prev = pendingReplacementKey.getState(prevState)
          const next = pendingReplacementKey.getState(view.state)
          if (!next || prev === next) return
          if (next.pending) {
            if (next.pending !== prev?.pending) handler({ type: 'update', pending: next.pending })
          } else if (next.ended && next.ended !== prev?.ended) {
            handler({ type: 'ended', pending: next.ended.pending, outcome: next.ended.outcome })
          }
        },
      }),
    }),
  )
}
