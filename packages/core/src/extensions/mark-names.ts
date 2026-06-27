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
  // mdHide is useless. Remove it. // TODO
  'mdHide',
] as const

export type MarkName = (typeof MARK_NAMES)[number]
