export const MARK_NAMES = [
  'mdImageView',
  'mdImageSource',
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
  'mdWikilinkSource',
  'mdWikilinkView',
  'mdPack',
] as const

export type MarkName = (typeof MARK_NAMES)[number]
