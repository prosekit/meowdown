import {
  defineKeymap,
  definePlugin,
  isNodeSelection,
  isTextSelection,
  Priority,
  union,
  withPriority,
  type MarkRange,
  type PlainExtension,
} from '@prosekit/core'
import type { Command, EditorState } from '@prosekit/pm/state'
import { Plugin, PluginKey, Selection, TextSelection } from '@prosekit/pm/state'
import { Decoration, DecorationSet } from '@prosekit/pm/view'

import { getMarkRangeAt } from './get-mark-range-at.ts'
import { getMarkMode, type MarkMode } from './mark-mode.ts'
import type { MarkName } from './mark-names.ts'

/**
 * The source marks whose mark views hide the raw text behind a rendered
 * preview (`.md-atom-view-preview`) and act as one caret stop.
 */
export const ATOM_SOURCE_MARK_NAMES: readonly MarkName[] = ['mdImage', 'mdWikilink', 'mdFile']

type AtomMarks = Array<{ name: MarkName; modes: ReadonlyArray<MarkMode> }>

export interface AtomMarkNavigationOptions {
  marks: AtomMarks
}

// The source marks that act as one atom in `state`'s current mark mode (empty
// when no mode is applied, which keeps the whole feature inert).
function activeMarkNames(marks: AtomMarks, state: EditorState): MarkName[] {
  const mode = getMarkMode(state)
  if (!mode) return []
  return marks.flatMap((mark) => (mark.modes.includes(mode) ? [mark.name] : []))
}

// The contiguous run of a single source mark that touches `pos`, or undefined.
function getRangeAt(state: EditorState, pos: number, markNames: MarkName[]): MarkRange | undefined {
  for (const name of markNames) {
    const range = getMarkRangeAt(state, pos, name)
    if (range) return range
  }
  return undefined
}

// The unit whose range ends exactly at `pos` (immediately left of the caret).
function getRangeBefore(
  state: EditorState,
  pos: number,
  markNames: MarkName[],
): MarkRange | undefined {
  const range = getRangeAt(state, pos, markNames)
  return range && range.to === pos ? range : undefined
}

// The unit whose range starts exactly at `pos` (immediately right of the caret).
function getRangeAfter(
  state: EditorState,
  pos: number,
  markNames: MarkName[],
): MarkRange | undefined {
  const range = getRangeAt(state, pos, markNames)
  return range && range.from === pos ? range : undefined
}

// The unit range a non-empty selection exactly spans, or undefined.
function getSelectedRange(state: EditorState, markNames: MarkName[]): MarkRange | undefined {
  const { from, to, empty } = state.selection
  if (empty) return
  const range = getRangeAt(state, from, markNames)
  return range && range.from === from && range.to === to ? range : undefined
}

function selectRange(state: EditorState, range: MarkRange): TextSelection {
  return TextSelection.create(state.doc, range.from, range.to)
}

// The blockwise step out of `pos`'s textblock in `direction`, or undefined when
// the step is not this keymap's to take. Chromium and WebKit cannot move the
// native caret across the contenteditable=false preview at a textblock edge,
// and prosemirror-view's own blockwise handling only covers vertical arrows.
function findSelectionAcrossBlockBoundary(
  state: EditorState,
  pos: number,
  markNames: MarkName[],
  direction: -1 | 1,
): Selection | undefined {
  const $pos = state.doc.resolve(pos)
  // Only a caret sitting exactly on the textblock edge can leave the block.
  const atEdge =
    direction === -1 ? $pos.parentOffset === 0 : $pos.parentOffset === $pos.parent.content.size
  if (!atEdge || $pos.depth === 0) return undefined
  // The unit being left behind: one starting (going left) or ending (going
  // right) exactly at the caret. Chromium/WebKit cannot walk out past it.
  const nearUnit =
    direction === -1 ? getRangeAfter(state, pos, markNames) : getRangeBefore(state, pos, markNames)
  // The nearest selection past the boundary: the adjacent textblock's near
  // edge, or a NodeSelection for a selectable block such as a horizontal rule
  // (the same landing prosemirror-view's moveSelectionBlock would pick).
  const boundary = direction === -1 ? $pos.before() : $pos.after()
  const target = Selection.findFrom(state.doc.resolve(boundary), direction)
  if (!target) return undefined
  // The unit being entered: one touching the landing position from the far
  // side. WebKit skips caret stops when walking into such a block.
  const farUnit = isTextSelection(target)
    ? direction === -1
      ? getRangeBefore(state, target.head, markNames)
      : getRangeAfter(state, target.head, markNames)
    : undefined
  // No unit on either side of the boundary: stay out of the browser's way
  // (native handles bidi/RTL horizontal motion better than we can).
  if (nearUnit == null && farUnit == null) return undefined
  return target
}

// ArrowRight: select the unit to the right, collapse a selected unit to its far
// edge, step past a unit to the left (which the browser cannot do), or step
// blockwise at the textblock end.
function createArrowRight(marks: AtomMarks): Command {
  return (state, dispatch) => {
    const markNames = activeMarkNames(marks, state)
    if (markNames.length === 0 || !isTextSelection(state.selection)) return false
    const selection = state.selection
    if (selection.empty) {
      const after = getRangeAfter(state, selection.from, markNames)
      if (after) {
        dispatch?.(state.tr.setSelection(selectRange(state, after)))
        return true
      }
      const before = getRangeBefore(state, selection.from, markNames)
      if (before && selection.from < state.doc.resolve(selection.from).end()) {
        dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, selection.from + 1)))
        return true
      }
      // The mirror of ArrowLeft. Not observed broken on desktop, but owning the
      // step keeps the walk deterministic instead of depending on the browser.
      const target = findSelectionAcrossBlockBoundary(state, selection.from, markNames, 1)
      if (!target) return false
      dispatch?.(state.tr.setSelection(target).scrollIntoView())
      return true
    }
    const range = getSelectedRange(state, markNames)
    if (!range) return false
    dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, range.to)))
    return true
  }
}

// ArrowLeft: select the unit to the left, collapse a selected unit to its near
// edge, or step blockwise at the textblock start.
function createArrowLeft(marks: AtomMarks): Command {
  return (state, dispatch) => {
    const markNames = activeMarkNames(marks, state)
    if (markNames.length === 0 || !isTextSelection(state.selection)) return false
    const selection = state.selection
    if (selection.empty) {
      const before = getRangeBefore(state, selection.from, markNames)
      if (before) {
        dispatch?.(state.tr.setSelection(selectRange(state, before)))
        return true
      }
      // At the textblock start, take the blockwise step: Chromium/WebKit's
      // native caret cannot leave a block that starts with a unit.
      const target = findSelectionAcrossBlockBoundary(state, selection.from, markNames, -1)
      if (!target) return false
      dispatch?.(state.tr.setSelection(target).scrollIntoView())
      return true
    }
    const range = getSelectedRange(state, markNames)
    if (!range) return false
    dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, range.from)))
    return true
  }
}

// Shift-Arrow: the selection head swallows an adjacent unit whole, or takes the
// blockwise step at a textblock edge. Without this, native extension creeps
// through the hidden source one invisible character per press.
function createShiftArrow(marks: AtomMarks, direction: -1 | 1): Command {
  return (state, dispatch) => {
    const markNames = activeMarkNames(marks, state)
    if (markNames.length === 0 || !isTextSelection(state.selection)) return false
    const { anchor, head } = state.selection
    // A unit whose edge sits exactly at the head enters (or leaves) the
    // selection whole; a head inside a revealed source keeps native per-char
    // behavior (the text is visible there).
    const unit =
      direction === -1
        ? getRangeBefore(state, head, markNames)
        : getRangeAfter(state, head, markNames)
    if (unit) {
      const nextHead = direction === -1 ? unit.from : unit.to
      dispatch?.(
        state.tr.setSelection(TextSelection.create(state.doc, anchor, nextHead)).scrollIntoView(),
      )
      return true
    }
    // At the textblock edge, move the head blockwise; only a textblock landing
    // can extend a text selection, so a NodeSelection target declines.
    const target = findSelectionAcrossBlockBoundary(state, head, markNames, direction)
    if (!target || !isTextSelection(target)) return false
    dispatch?.(
      state.tr.setSelection(TextSelection.create(state.doc, anchor, target.head)).scrollIntoView(),
    )
    return true
  }
}

// Backspace: delete a whole unit to the left, or delete one character to the
// left while next to a unit (the browser's native delete mangles the hidden
// source). A selected unit falls through to the base `deleteSelection`.
function createBackspace(marks: AtomMarks): Command {
  return (state, dispatch) => {
    const markNames = activeMarkNames(marks, state)
    if (markNames.length === 0 || !state.selection.empty) return false
    const pos = state.selection.from
    const before = getRangeBefore(state, pos, markNames)
    if (before) {
      dispatch?.(state.tr.delete(before.from, before.to))
      return true
    }
    if (!getRangeAfter(state, pos, markNames)) return false
    if (pos <= state.doc.resolve(pos).start()) return false
    dispatch?.(state.tr.delete(pos - 1, pos))
    return true
  }
}

// Delete: the forward mirror of `backspace`.
function createForwardDelete(marks: AtomMarks): Command {
  return (state, dispatch) => {
    const markNames = activeMarkNames(marks, state)
    if (markNames.length === 0 || !state.selection.empty) return false
    const pos = state.selection.from
    const after = getRangeAfter(state, pos, markNames)
    if (after) {
      dispatch?.(state.tr.delete(after.from, after.to))
      return true
    }
    if (!getRangeBefore(state, pos, markNames)) return false
    if (pos >= state.doc.resolve(pos).end()) return false
    dispatch?.(state.tr.delete(pos, pos + 1))
    return true
  }
}

const SELECTED_CLASS = 'md-atom-selected'

// Decorate each selected atom's source range with `md-atom-selected`, so its
// mark view can ring the rendered preview/label.
function createSelectionPlugin(marks: AtomMarks): Plugin {
  return new Plugin({
    key: new PluginKey('atom-mark-selection'),
    props: {
      decorations: (state) => {
        const markNames = activeMarkNames(marks, state)
        if (markNames.length === 0) return
        // A node selection already outlines the whole block; atom rings inside
        // it would read as a second, nested selection.
        if (isNodeSelection(state.selection)) return
        const range = getSelectedRange(state, markNames)
        if (range) {
          return DecorationSet.create(state.doc, [
            Decoration.inline(range.from, range.to, { class: SELECTED_CLASS }),
          ])
        }

        const { from, to, empty } = state.selection
        if (empty) return null

        const decorations: Decoration[] = []
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.marks.some((mark) => markNames.includes(mark.type.name as MarkName))) {
            decorations.push(Decoration.inline(pos, pos + node.nodeSize, { class: SELECTED_CLASS }))
          }
        })
        return DecorationSet.create(state.doc, decorations)
      },
    },
  })
}

/**
 * Make a text-backed source unit a single caret stop in the listed mark modes:
 * arrowing onto it selects the whole source, Shift-arrowing extends over it
 * whole, arrows cross textblock boundaries it touches (which the browser's
 * native caret cannot), and Backspace/Delete remove it as a unit.
 */
export function defineAtomMarkNavigation({ marks }: AtomMarkNavigationOptions): PlainExtension {
  return union(
    withPriority(
      defineKeymap({
        ArrowRight: createArrowRight(marks),
        ArrowLeft: createArrowLeft(marks),
        'Shift-ArrowRight': createShiftArrow(marks, 1),
        'Shift-ArrowLeft': createShiftArrow(marks, -1),
        Backspace: createBackspace(marks),
        Delete: createForwardDelete(marks),
      }),
      Priority.high,
    ),
    definePlugin(createSelectionPlugin(marks)),
  )
}
