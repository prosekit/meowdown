export const MARK_NAMES = [
  'mdImageView',
  'mdImageSource',
  'mdMark',
  'mdEm',
  'mdStrong',
  'mdCode',
  'mdLinkText',
  'mdLinkUri',
  'mdDel',
  'mdTag',
  'mdWikilinkSource',
  'mdWikilinkView',
] as const

export type MarkName = (typeof MARK_NAMES)[number]
