import {
  defineKeymap,
  definePlugin,
  getMarkRange,
  isTextSelection,
  Priority,
  union,
  withPriority,
  type MarkRange,
  type PlainExtension,
} from '@prosekit/core'
import type { Command, EditorState } from '@prosekit/pm/state'
import { Plugin, PluginKey, TextSelection } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'
import { Decoration, DecorationSet } from '@prosekit/pm/view'

import { getMarkMode } from './mark-mode.ts'
import type { MarkName } from './mark-names.ts'

export interface AtomicMarkNavigationOptions {
  /** The source marks (e.g. `mdImageSource`) whose run is one atomic unit. */
  markNames: MarkName[]
  /** Decoration class added over the source range while the unit is selected. */
  selectedClass: string
}

// The contiguous run of one atomic source mark that touches `pos`, or undefined.
function getRangeAt(state: EditorState, pos: number, markNames: MarkName[]): MarkRange | undefined {
  const $pos = state.doc.resolve(pos)
  for (const name of markNames) {
    const range = getMarkRange($pos, name)
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

function isHideMode(view: EditorView | undefined): boolean {
  return !!view && getMarkMode(view) === 'hide'
}

function selectRange(state: EditorState, range: MarkRange): TextSelection {
  return TextSelection.create(state.doc, range.from, range.to)
}

// ArrowRight: select the unit to the right, collapse a selected unit to its far
// edge, or step past a unit to the left (which the browser cannot do).
function createArrowRight(markNames: MarkName[]): Command {
  return (state, dispatch, view) => {
    if (!isHideMode(view) || !isTextSelection(state.selection)) return false
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
function createArrowLeft(markNames: MarkName[]): Command {
  return (state, dispatch, view) => {
    if (!isHideMode(view) || !isTextSelection(state.selection)) return false
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
function createBackspace(markNames: MarkName[]): Command {
  return (state, dispatch, view) => {
    if (!isHideMode(view) || !state.selection.empty) return false
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
function createForwardDelete(markNames: MarkName[]): Command {
  return (state, dispatch, view) => {
    if (!isHideMode(view) || !state.selection.empty) return false
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
function createSelectionPlugin(markNames: MarkName[], selectedClass: string): Plugin {
  return new Plugin({
    key: new PluginKey(`atomic-mark-selection-${selectedClass}`),
    props: {
      decorations: (state) => {
        const range = getSelectedRange(state, markNames)
        if (!range) return null
        return DecorationSet.create(state.doc, [
          Decoration.inline(range.from, range.to, { class: selectedClass }),
        ])
      },
    },
  })
}

/**
 * In hide mode, make a hidden text-backed unit (an image source, a wikilink
 * source) a single caret stop: arrowing onto it selects the whole source (ringed
 * by a `selectedClass` decoration), and Backspace/Delete remove it as a unit.
 * Inert in show mode and without `defineMarkMode('hide')`.
 */
export function defineAtomicMarkNavigation({
  markNames,
  selectedClass,
}: AtomicMarkNavigationOptions): PlainExtension {
  return union(
    withPriority(
      defineKeymap({
        ArrowRight: createArrowRight(markNames),
        ArrowLeft: createArrowLeft(markNames),
        Backspace: createBackspace(markNames),
        Delete: createForwardDelete(markNames),
      }),
      Priority.high,
    ),
    definePlugin(createSelectionPlugin(markNames, selectedClass)),
  )
}
