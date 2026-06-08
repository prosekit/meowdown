import type { EditorNode } from '@prosekit/pm/model'

/**
 * Names of the marks at the given absolute position, sorted.
 */
export function marksAt(doc: EditorNode, pos: number): string[] {
  return doc
    .resolve(pos)
    .marks()
    .map((m) => m.type.name)
    .sort()
}
