import {
  defineKeymap,
  definePlugin,
  getMarkRange,
  getMarkType,
  Priority,
  union,
  withPriority,
  type PlainExtension,
} from '@prosekit/core'
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
} from '@prosekit/pm/state'

import { getMarkMode } from './mark-mode.ts'
import type { MarkName } from './mark-names.ts'

/**
 * In `hide` mode the Markdown syntax of an inline unit (`**`, `[`, `](url)`, ...)
 * is real text that is never rendered, so the caret can rest in an invisible
 * "dead zone" between a hidden marker run and the visible content. Acting there
 * (Enter, Space, typing) silently corrupts the unit. These two hooks keep the
 * caret out of that dead zone while leaving the content - down to a single
 * character - reachable. The feature is inert outside `hide` mode, where the
 * markers are visible (`show`) or revealed near the caret (`focus`).
 */

// Marks whose characters `mark-mode` hides in `hide` mode (mirrors its CSS
// `display:none` rules and its clipboard strip set). A contiguous run of these
// is invisible, so the caret must not act inside it.
const HIDDEN_MARKS: ReadonlySet<MarkName> = new Set<MarkName>([
  'mdMark',
  'mdLinkUri',
  'mdLinkTitle',
])

function charIsHidden(state: EditorState, charStart: number): boolean {
  let hidden = false
  state.doc.nodesBetween(charStart, charStart + 1, (node) => {
    if (node.isText)
      hidden = node.marks.some((mark) => HIDDEN_MARKS.has(mark.type.name as MarkName))
  })
  return hidden
}

interface UnitInfo {
  from: number
  to: number
  /** End of the leading hidden run, i.e. the content's opening edge (after `**` / `[`). */
  openTo: number
  /** Start of the trailing hidden run, i.e. the content's closing edge (before `**` / `](url)`). */
  closeFrom: number
}

/** The `mdPack` unit around `pos`, with its hidden marker runs measured by walking. */
function unitInfoAt(state: EditorState, pos: number): UnitInfo | undefined {
  const $pos = state.doc.resolve(pos)
  if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return undefined
  const unit = getMarkRange($pos, getMarkType(state.schema, 'mdPack'))
  if (!unit) return undefined
  let openTo = unit.from
  while (openTo < unit.to && charIsHidden(state, openTo)) openTo++
  let closeFrom = unit.to
  while (closeFrom > unit.from && charIsHidden(state, closeFrom - 1)) closeFrom--
  return { from: unit.from, to: unit.to, openTo, closeFrom }
}

/** `pos` is inside the leading hidden run or at its content edge. */
function inOpening(info: UnitInfo, pos: number): boolean {
  return pos > info.from && pos <= info.openTo && info.openTo < info.to
}
/** `pos` is inside the trailing hidden run or at its content edge. */
function inClosing(info: UnitInfo, pos: number): boolean {
  return pos >= info.closeFrom && pos < info.to && info.closeFrom > info.from
}

/** The unit's outer edge a pointer click or Enter relocates to, or `undefined`. */
function outerEdge(info: UnitInfo, pos: number): number | undefined {
  if (inOpening(info, pos)) return info.from
  if (inClosing(info, pos)) return info.to
  return undefined
}

const snapPluginKey = new PluginKey('meowdown-caret-marker-snap')

function createSnapPlugin(): Plugin {
  return new Plugin({
    key: snapPluginKey,
    appendTransaction: (transactions, oldState, newState) => {
      if (getMarkMode(newState) !== 'hide') return null
      const { selection } = newState
      if (!selection.empty) return null
      const pos = selection.from
      const info = unitInfoAt(newState, pos)
      if (!info) return null

      // prosemirror-view tags pointer-originated selections with this meta in
      // `updateSelection`:
      // https://code.haverbeke.berlin/prosemirror/prosemirror-view/src/tag/1.41.9/src/input.ts#L191
      const isPointer = transactions.some((tr) => !!tr.getMeta('pointer'))

      let target: number | undefined
      if (isPointer) {
        // A click aims at the visible content edge, i.e. outside the unit.
        target = outerEdge(info, pos)
      } else {
        // Keyboard: skip only the invisible marker interior, in the travel
        // direction. Content edges stay reachable so the content is navigable.
        const dir = pos >= oldState.selection.from ? 1 : -1
        if (pos > info.from && pos < info.openTo) {
          target = dir > 0 ? info.openTo : info.from
        } else if (pos > info.closeFrom && pos < info.to) {
          target = dir > 0 ? info.to : info.closeFrom
        }
      }
      if (target == null || target === pos) return null
      return newState.tr.setSelection(TextSelection.create(newState.doc, target))
    },
  })
}

/**
 * Enter at a content edge would split the unit's hidden syntax from its content
 * (`**foo**` -> `**` / `foo**`). Relocate the caret to the unit's outer edge,
 * then return `false` so the normal Enter chain (flat-list / base) splits there.
 */
const enterOutsideMarkers: Command = (state, dispatch) => {
  if (getMarkMode(state) !== 'hide') return false
  const { selection } = state
  if (!selection.empty) return false
  const info = unitInfoAt(state, selection.from)
  if (!info) return false
  const target = outerEdge(info, selection.from)
  if (target == null || target === selection.from) return false
  dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, target)))
  return false
}

export function defineCaretMarkerSnap(): PlainExtension {
  return union(
    definePlugin(createSnapPlugin()),
    withPriority(defineKeymap({ Enter: enterOutsideMarkers }), Priority.high),
  )
}
