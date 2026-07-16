import type { ProseMirrorNode } from '@prosekit/pm/model'

/**
 * Every ProseMirror node name the editor schema knows about.
 */
export const NODE_NAMES = [
  'doc',
  'text',
  'paragraph',
  'heading',
  'blockquote',
  'list',
  'codeBlock',
  'horizontalRule',
  'htmlComment',
  'table',
  'tableRow',
  'tableCell',
  'tableHeaderCell',
] as const

export type NodeName = (typeof NODE_NAMES)[number]

export function isNodeOfType(node: ProseMirrorNode, name: NodeName): boolean {
  return node.type.name === name
}
