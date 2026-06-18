import type { EditorState } from '@prosekit/pm/state'

import {
  UNICODE_LEFT_HALF_BLOCK,
  UNICODE_QUADRANT_UPPER_LEFT_AND_UPPER_RIGHT_AND_LOWER_LEFT,
  UNICODE_QUADRANT_UPPER_RIGHT_AND_LOWER_LEFT_AND_LOWER_RIGHT,
} from '../unicode.ts'

const TEXT_CARET = UNICODE_LEFT_HALF_BLOCK
const SELECTION_START = UNICODE_QUADRANT_UPPER_LEFT_AND_UPPER_RIGHT_AND_LOWER_LEFT
const SELECTION_END = UNICODE_QUADRANT_UPPER_RIGHT_AND_LOWER_LEFT_AND_LOWER_RIGHT

/**
 * Render the document's text with the selection drawn in.
 */
export function getSelectionSnapshot(state: EditorState): string {
  const { doc, selection } = state
  const { from, to } = selection

  if (from === to) {
    return doc.textBetween(0, from) + TEXT_CARET + doc.textBetween(to, doc.content.size)
  } else {
    return (
      doc.textBetween(0, from) +
      SELECTION_START +
      doc.textBetween(from, to) +
      SELECTION_END +
      doc.textBetween(to, doc.content.size)
    )
  }
}
