export const MARK_NAMES = [
  'mdWikilinkV2',
  'mdImageV2',
  'mdImageView',
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
  'mdHide',
] as const

export type MarkName = (typeof MARK_NAMES)[number]
