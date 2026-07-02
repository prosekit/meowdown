import type { EditorState } from '@prosekit/pm/state'

import {
  UNICODE_BOX_DRAWINGS_HEAVY_VERTICAL,
  UNICODE_HEAVY_LEFT_POINTING_ANGLE_BRACKET_ORNAMENT,
  UNICODE_HEAVY_RIGHT_POINTING_ANGLE_BRACKET_ORNAMENT,
} from '../unicode.ts'

const TEXT_CARET = UNICODE_BOX_DRAWINGS_HEAVY_VERTICAL
const SELECTION_START = UNICODE_HEAVY_LEFT_POINTING_ANGLE_BRACKET_ORNAMENT
const SELECTION_END = UNICODE_HEAVY_RIGHT_POINTING_ANGLE_BRACKET_ORNAMENT

/**
 * Render the document's text with the selection drawn in.
 */
export function getSelectionSnapshot(state: EditorState): string {
  const { doc, selection } = state
  const { from, to } = selection

  if (from === to) {
    return doc.textBetween(0, from, '\n') + TEXT_CARET + doc.textBetween(to, doc.content.size, '\n')
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
