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

// Mirrors the hide/focus CSS rules that collapse syntax-only text.
export const HIDDEN_SYNTAX_MARK_NAMES: ReadonlySet<MarkName> = new Set<MarkName>([
  'mdMark',
  'mdLinkUri',
  'mdLinkTitle',
])
