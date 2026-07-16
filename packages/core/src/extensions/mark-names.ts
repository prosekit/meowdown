export const MARK_NAMES = [
  'mdWikilink',
  'mdImage',
  'mdFile',
  'mdMath',
  'mdMark',
  'mdEm',
  'mdStrong',
  'mdCode',
  'mdLinkText',
  'mdLinkUri',
  'mdLinkTitle',
  'mdDel',
  'mdHighlight',
  'mdTag',
  'mdPack',
] as const

export type MarkName = (typeof MARK_NAMES)[number]

// Marks whose text is Markdown syntax rather than content. Hide mode renders
// these runs at font-size 0 (mirroring the CSS rules in style.css), and text
// projections drop them.
export const SYNTAX_MARK_NAMES: ReadonlySet<string> = new Set<MarkName>([
  'mdMark',
  'mdLinkUri',
  'mdLinkTitle',
])

// Marks covering a whole source unit, emitted as one replacement per unit by
// text projections. The subset whose mark views hide the raw source behind a
// preview lives in ATOM_SOURCE_MARK_NAMES in atom-mark-navigation.ts.
export const ATOM_MARK_NAMES: ReadonlySet<string> = new Set<MarkName>([
  'mdWikilink',
  'mdImage',
  'mdFile',
  'mdMath',
])
