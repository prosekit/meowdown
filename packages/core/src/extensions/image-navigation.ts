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
import type { EditorView } from '@prosekit/pm/view'
import { Decoration, DecorationSet } from '@prosekit/pm/view'

import { getMarkRangeAt } from './get-mark-range-at.ts'
import { getMarkMode } from './mark-mode.ts'

// The contiguous run of `mdImageSource` text that touches `pos`, or undefined.
function getImageSourceRangeAt(state: EditorState, pos: number): MarkRange | undefined {
  return getMarkRangeAt(state, pos, 'mdImageSource')
}

// The image whose range ends exactly at `pos` (immediately left of the caret).
function getImageBefore(state: EditorState, pos: number): MarkRange | undefined {
  const range = getImageSourceRangeAt(state, pos)
  return range && range.to === pos ? range : undefined
}

// The image whose range starts exactly at `pos` (immediately right of the caret).
function getImageAfter(state: EditorState, pos: number): MarkRange | undefined {
  const range = getImageSourceRangeAt(state, pos)
  return range && range.from === pos ? range : undefined
}

// The image range a non-empty selection exactly spans, or undefined.
function getSelectedImageRange(state: EditorState): MarkRange | undefined {
  const { from, to, empty } = state.selection
  if (empty) return
  const range = getImageSourceRangeAt(state, from)
  return range && range.from === from && range.to === to ? range : undefined
}

function isHideMode(view: EditorView | undefined): boolean {
  return !!view && getMarkMode(view) === 'hide'
}

function selectRange(state: EditorState, range: MarkRange): TextSelection {
  return TextSelection.create(state.doc, range.from, range.to)
}

// ArrowRight: select the image to the right, collapse a selected image to its
// far edge, or step past an image to the left (which the browser cannot do).
const arrowRight: Command = (state, dispatch, view) => {
  if (!isHideMode(view) || !isTextSelection(state.selection)) return false
  const selection = state.selection
  if (selection.empty) {
    const after = getImageAfter(state, selection.from)
    if (after) {
      dispatch?.(state.tr.setSelection(selectRange(state, after)))
      return true
    }
    const before = getImageBefore(state, selection.from)
    if (before) {
      const $from = state.doc.resolve(selection.from)
      if (selection.from >= $from.end()) return false
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, selection.from + 1)))
      return true
    }
    return false
  }
  const range = getSelectedImageRange(state)
  if (!range) return false
  dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, range.to)))
  return true
}

// ArrowLeft: select the image to the left, or collapse a selected image to its
// near edge.
const arrowLeft: Command = (state, dispatch, view) => {
  if (!isHideMode(view) || !isTextSelection(state.selection)) return false
  const selection = state.selection
  if (selection.empty) {
    const before = getImageBefore(state, selection.from)
    if (!before) return false
    dispatch?.(state.tr.setSelection(selectRange(state, before)))
    return true
  }
  const range = getSelectedImageRange(state)
  if (!range) return false
  dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, range.from)))
  return true
}

// Backspace: delete a whole image to the left, or delete one character to the
// left while next to an image (the browser's native delete mangles the hidden
// source). A selected image falls through to the base `deleteSelection`.
const backspace: Command = (state, dispatch, view) => {
  if (!isHideMode(view) || !state.selection.empty) return false
  const pos = state.selection.from
  const before = getImageBefore(state, pos)
  if (before) {
    dispatch?.(state.tr.delete(before.from, before.to))
    return true
  }
  if (!getImageAfter(state, pos)) return false
  if (pos <= state.doc.resolve(pos).start()) return false
  dispatch?.(state.tr.delete(pos - 1, pos))
  return true
}

// Delete: the forward mirror of `backspace`.
const forwardDelete: Command = (state, dispatch, view) => {
  if (!isHideMode(view) || !state.selection.empty) return false
  const pos = state.selection.from
  const after = getImageAfter(state, pos)
  if (after) {
    dispatch?.(state.tr.delete(after.from, after.to))
    return true
  }
  if (!getImageBefore(state, pos)) return false
  if (pos >= state.doc.resolve(pos).end()) return false
  dispatch?.(state.tr.delete(pos, pos + 1))
  return true
}

// Ring the preview when its whole source is selected (see `style.css`).
function createImageSelectionPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('image-selection'),
    props: {
      decorations: (state) => {
        const range = getSelectedImageRange(state)
        if (!range) return null
        return DecorationSet.create(state.doc, [
          Decoration.inline(range.from, range.to, { class: 'md-image-selected' }),
        ])
      },
    },
  })
}

/**
 * In hide mode, make a hidden image a single caret stop: arrowing onto it
 * selects the whole `![alt](url)` (ringed by a decoration), and Backspace/Delete
 * remove it as a unit. Inert in show mode and without `defineMarkMode('hide')`.
 */
export function defineImageNavigation(): PlainExtension {
  return union(
    withPriority(
      defineKeymap({
        ArrowRight: arrowRight,
        ArrowLeft: arrowLeft,
        Backspace: backspace,
        Delete: forwardDelete,
      }),
      Priority.high,
    ),
    definePlugin(createImageSelectionPlugin()),
  )
}
