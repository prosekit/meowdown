import type { Mark } from '@prosekit/pm/model'

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

export function isMarkOfType(mark: Mark, name: MarkName): boolean {
  return mark.type.name === name
}

export function isMarkOfTypes(mark: Mark, names: readonly MarkName[]): boolean {
  return names.includes(mark.type.name as MarkName)
}

// Marks whose text is Markdown syntax rather than content. Hide mode renders
// these runs at font-size 0 (mirroring the CSS rules in style.css), and text
// projections drop them.
export const SYNTAX_MARK_NAMES: readonly MarkName[] = ['mdMark', 'mdLinkUri', 'mdLinkTitle']

// Marks covering a whole source unit, emitted as one replacement per unit by
// text projections.
export const ATOM_MARK_NAMES: readonly MarkName[] = ['mdWikilink', 'mdImage', 'mdFile', 'mdMath']

// The source marks whose mark views hide the raw text behind a rendered
// preview (`.md-atom-view-preview`) and act as one caret stop.
export const ATOM_SOURCE_MARK_NAMES: readonly MarkName[] = ['mdImage', 'mdWikilink', 'mdFile']
