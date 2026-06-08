import type { EditorNode } from '@prosekit/pm/model'

/**
 * Finds the absolute position of the first text node containing `query`, or -1.
 */
export function findText(doc: EditorNode, query: string): number {
  let found = -1
  doc.descendants((node, pos) => {
    if (found >= 0) return false
    if (node.isText && node.text) {
      const index = node.text.indexOf(query)
      if (index >= 0) {
        found = pos + index
        return false
      }
    }
    return true
  })
  return found
}
