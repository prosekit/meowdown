import type { EditorState } from '@prosekit/pm/state'

/**
 * The plain text of the current selection, with block boundaries as blank
 * lines. Inline Markdown syntax is literal text in the document, so the
 * result reads as Markdown for inline content.
 */
export function getSelectedText(state: EditorState): string {
  const { from, to } = state.selection
  return state.doc.textBetween(from, to, '\n\n')
}
