import type { EditorState } from '@prosekit/pm/state'

import { docToMarkdown } from '../converters/pm-to-md.ts'

/**
 * The current selection as Markdown: block structure (list markers, headings,
 * blockquotes) is serialized, and inline Markdown syntax is already literal
 * text in the document. A selection inside one textblock comes back as its
 * bare text; a multi-block selection keeps its block markers, so downstream
 * consumers (e.g. an AI prompt) see the same Markdown the user would.
 */
export function getSelectedText(state: EditorState): string {
  const { selection, schema } = state
  if (selection.empty) return ''
  const fragment = selection.content().content
  try {
    const doc = schema.topNodeType.create(null, fragment)
    return docToMarkdown(doc).replace(/\n+$/, '')
  } catch {
    // A fragment the doc type cannot hold (e.g. a bare table row) falls back
    // to plain text with block boundaries as blank lines.
    return state.doc.textBetween(selection.from, selection.to, '\n\n')
  }
}
