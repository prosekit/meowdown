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
  'table',
  'tableRow',
  'tableCell',
  'tableHeaderCell',
] as const

// This is not used yet
// export type NodeName = (typeof NODE_NAMES)[number]
