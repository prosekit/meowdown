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
  'htmlBlock',
  'table',
  'tableRow',
  'tableCell',
  'tableHeaderCell',
] as const

export type NodeName = (typeof NODE_NAMES)[number]
