export const MARK_NAMES = [
  'mdImageV2',
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
  'mdHide',
] as const

export type MarkName = (typeof MARK_NAMES)[number]
