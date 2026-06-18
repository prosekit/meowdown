import {
  defineKeymap,
  definePlugin,
  isTextSelection,
  Priority,
  union,
  withPriority,
  type MarkRange,
  type PlainExtension,
} from '@prosekit/core'
import type { Command, EditorState } from '@prosekit/pm/state'
import { Plugin, PluginKey, TextSelection } from '@prosekit/pm/state'
import { Decoration, DecorationSet } from '@prosekit/pm/view'

import { getMarkRangeAt } from './get-mark-range-at.ts'
import { getMarkMode, type MarkMode } from './mark-mode.ts'
import type { MarkName } from './mark-names.ts'

type AtomicMarks = Array<{ name: MarkName; modes: ReadonlyArray<MarkMode> }>

export interface AtomicMarkNavigationOptions {
  /**
   * Each source mark (e.g. `mdImageSource`) paired with the mark modes in which
   * its run is one atomic unit.
   */
  marks: AtomicMarks
  /** Decoration class added over the source range while the unit is selected. */
  selectedClass: string
}

// The source marks that are atomic in `state`'s current mark mode (empty when no
// mode is applied, which keeps the whole feature inert).
function activeMarkNames(marks: AtomicMarks, state: EditorState): MarkName[] {
  const mode = getMarkMode(state)
  if (!mode) return []
  return marks.flatMap((mark) => (mark.modes.includes(mode) ? [mark.name] : []))
}

// The contiguous run of one atomic source mark that touches `pos`, or undefined.
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

// ArrowRight: select the unit to the right, collapse a selected unit to its far
// edge, or step past a unit to the left (which the browser cannot do).
function createArrowRight(marks: AtomicMarks): Command {
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
      if (before) {
        const $from = state.doc.resolve(selection.from)
        if (selection.from >= $from.end()) return false
        dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, selection.from + 1)))
        return true
      }
      return false
    }
    const range = getSelectedRange(state, markNames)
    if (!range) return false
    dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, range.to)))
    return true
  }
}

// ArrowLeft: select the unit to the left, or collapse a selected unit to its
// near edge.
function createArrowLeft(marks: AtomicMarks): Command {
  return (state, dispatch) => {
    const markNames = activeMarkNames(marks, state)
    if (markNames.length === 0 || !isTextSelection(state.selection)) return false
    const selection = state.selection
    if (selection.empty) {
      const before = getRangeBefore(state, selection.from, markNames)
      if (!before) return false
      dispatch?.(state.tr.setSelection(selectRange(state, before)))
      return true
    }
    const range = getSelectedRange(state, markNames)
    if (!range) return false
    dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, range.from)))
    return true
  }
}

// Backspace: delete a whole unit to the left, or delete one character to the
// left while next to a unit (the browser's native delete mangles the hidden
// source). A selected unit falls through to the base `deleteSelection`.
function createBackspace(marks: AtomicMarks): Command {
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
function createForwardDelete(marks: AtomicMarks): Command {
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

// Mark the source range while its whole unit is selected (see `style.css`).
function createSelectionPlugin(marks: AtomicMarks, selectedClass: string): Plugin {
  return new Plugin({
    key: new PluginKey(`atomic-mark-selection-${selectedClass}`),
    props: {
      decorations: (state) => {
        const markNames = activeMarkNames(marks, state)
        if (markNames.length === 0) return
        const range = getSelectedRange(state, markNames)
        if (!range) return
        return DecorationSet.create(state.doc, [
          Decoration.inline(range.from, range.to, { class: selectedClass }),
        ])
      },
    },
  })
}

/**
 * Make a text-backed source unit (an image source, a wikilink source) a single
 * caret stop in the mark modes listed per mark: arrowing onto it selects the
 * whole source (ringed by a `selectedClass` decoration), and Backspace/Delete
 * remove it as a unit. Inert in any mode a mark does not list, and without
 * `defineMarkMode`.
 */
export function defineAtomicMarkNavigation({
  marks,
  selectedClass,
}: AtomicMarkNavigationOptions): PlainExtension {
  return union(
    withPriority(
      defineKeymap({
        ArrowRight: createArrowRight(marks),
        ArrowLeft: createArrowLeft(marks),
        Backspace: createBackspace(marks),
        Delete: createForwardDelete(marks),
      }),
      Priority.high,
    ),
    definePlugin(createSelectionPlugin(marks, selectedClass)),
  )
}
