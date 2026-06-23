/**
 * Every `@lezer/markdown` node name `gfmParser` knows about. A unit test pins
 * this list against the parser's `nodeSet` so a `@lezer/ markdown` upgrade that
 * renames a node fails loudly.
 */
export const LEZER_NODE_NAMES = [
  // Document root
  'Document',
  // Block
  'Paragraph',
  'Blockquote',
  'BulletList',
  'OrderedList',
  'ListItem',
  'FencedCode',
  'CodeBlock',
  'HorizontalRule',
  'ATXHeading1',
  'ATXHeading2',
  'ATXHeading3',
  'ATXHeading4',
  'ATXHeading5',
  'ATXHeading6',
  'SetextHeading1',
  'SetextHeading2',
  // HTML / processing
  'HTMLBlock',
  'HTMLTag',
  'CommentBlock',
  'Comment',
  'ProcessingInstructionBlock',
  'ProcessingInstruction',
  // Link references
  'LinkReference',
  'LinkLabel',
  'LinkTitle',
  // Block-level structural marks
  'HeaderMark',
  'QuoteMark',
  'ListMark',
  'CodeMark',
  'CodeInfo',
  'CodeText',
  // GFM table
  'Table',
  'TableHeader',
  'TableRow',
  'TableCell',
  'TableDelimiter',
  // GFM task list
  'Task',
  'TaskMarker',
  // Inline
  'Emphasis',
  'StrongEmphasis',
  'InlineCode',
  'Strikethrough',
  'Link',
  'Image',
  'URL',
  'Autolink',
  'Escape',
  'Entity',
  'HardBreak',
  // Inline structural marks
  'EmphasisMark',
  'LinkMark',
  'StrikethroughMark',

  // Custom inline (meowdown extensions)
  'Hashtag',
  'Wikilink',
  'WikilinkMark',
  'Highlight',
  'HighlightMark',
] as const

export type LezerNodeName = (typeof LEZER_NODE_NAMES)[number]
