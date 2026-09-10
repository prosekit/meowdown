import type { EditorState } from '@prosekit/pm/state'
import {
  BOX_DRAWINGS_HEAVY_VERTICAL,
  HEAVY_LEFT_POINTING_ANGLE_BRACKET_ORNAMENT,
  HEAVY_RIGHT_POINTING_ANGLE_BRACKET_ORNAMENT,
  LEFT_SQUARE_BRACKET_LOWER_CORNER,
  RIGHT_SQUARE_BRACKET_LOWER_CORNER,
} from 'unicode-by-name'

import { getCaretTail, getHiddenPredicate } from '../extensions/hidden-run.ts'

const TEXT_CARET = BOX_DRAWINGS_HEAVY_VERTICAL
const TEXT_CARET_TAIL_LEFT = RIGHT_SQUARE_BRACKET_LOWER_CORNER
const TEXT_CARET_TAIL_RIGHT = LEFT_SQUARE_BRACKET_LOWER_CORNER
const SELECTION_START = HEAVY_LEFT_POINTING_ANGLE_BRACKET_ORNAMENT
const SELECTION_END = HEAVY_RIGHT_POINTING_ANGLE_BRACKET_ORNAMENT

// The caret glyph mirrors the rendered virtual caret: a caret at the boundary
// of a run the current mode hides carries a typing-affinity tail.
function getCaretGlyph(state: EditorState): string {
  const tail = getCaretTail(state, state.selection.from, getHiddenPredicate(state))
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
