import type { EditorState } from '@prosekit/pm/state'

import { getCaretTail } from '../extensions/hidden-run.ts'
import { getMarkMode } from '../extensions/mark-mode.ts'
import {
  UNICODE_BOX_DRAWINGS_HEAVY_VERTICAL,
  UNICODE_BOX_DRAWINGS_HEAVY_VERTICAL_AND_LEFT,
  UNICODE_BOX_DRAWINGS_HEAVY_VERTICAL_AND_RIGHT,
  UNICODE_HEAVY_LEFT_POINTING_ANGLE_BRACKET_ORNAMENT,
  UNICODE_HEAVY_RIGHT_POINTING_ANGLE_BRACKET_ORNAMENT,
} from '../unicode.ts'

const TEXT_CARET = UNICODE_BOX_DRAWINGS_HEAVY_VERTICAL
const TEXT_CARET_TAIL_LEFT = UNICODE_BOX_DRAWINGS_HEAVY_VERTICAL_AND_LEFT
const TEXT_CARET_TAIL_RIGHT = UNICODE_BOX_DRAWINGS_HEAVY_VERTICAL_AND_RIGHT
const SELECTION_START = UNICODE_HEAVY_LEFT_POINTING_ANGLE_BRACKET_ORNAMENT
const SELECTION_END = UNICODE_HEAVY_RIGHT_POINTING_ANGLE_BRACKET_ORNAMENT

// The caret glyph mirrors the rendered virtual caret: in hide mode a caret at
// a hidden run boundary carries a typing-affinity tail.
function getCaretGlyph(state: EditorState): string {
  if (getMarkMode(state) !== 'hide') return TEXT_CARET
  const tail = getCaretTail(state, state.selection.from)
  if (tail === 'left') return TEXT_CARET_TAIL_LEFT
  if (tail === 'right') return TEXT_CARET_TAIL_RIGHT
  return TEXT_CARET
}

/**
 * Render the document's text with the selection drawn in.
 */
export function getSelectionSnapshot(state: EditorState): string {
  const { doc, selection } = state
  const { from, to } = selection

  if (from === to) {
    return (
      doc.textBetween(0, from, '\n') +
      getCaretGlyph(state) +
      doc.textBetween(to, doc.content.size, '\n')
    )
  } else {
    return (
      doc.textBetween(0, from, '\n') +
      SELECTION_START +
      doc.textBetween(from, to, '\n') +
      SELECTION_END +
      doc.textBetween(to, doc.content.size, '\n')
    )
  }
}
