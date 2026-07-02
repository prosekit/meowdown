import type { EditorView } from '@prosekit/pm/view'
import { findText } from './find-text.ts'

export function replaceText(view: EditorView, query: string, replacement: string) {
  const from = findText(view.state.doc, query)
  if (from < 0) throw new Error(`Text "${query}" not found`)
  const to = from + query.length
  view.dispatch(view.state.tr.insertText(replacement, from, to))
}
