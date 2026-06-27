export const MARK_NAMES = [
  'mdWikilinkV2',
  'mdImageV2',
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
