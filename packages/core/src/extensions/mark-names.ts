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

// Marks whose text is Markdown syntax rather than content. Hide mode renders
// these runs at font-size 0 (mirroring the CSS rules in style.css), and text
// projections drop them.
export const SYNTAX_MARK_NAMES: ReadonlySet<string> = new Set<MarkName>([
  'mdMark',
  'mdLinkUri',
  'mdLinkTitle',
])

interface UnitKind {
  /**
   * The mark covering the unit's whole source, carrying its payload.
   */
  sourceMark?: MarkName
  /**
   * The mark view hides the source behind a rendered preview.
   */
  preview?: true
}

/**
 * Every inline unit kind that carries an `mdPack`, keyed by the pack's `key` attr.
 */
export const UNIT_KINDS = {
  italic: {},
  bold: {},
  code: {},
  strike: {},
  highlight: {},
  autolink: {},
  link: {},
  math: { sourceMark: 'mdMath' },
  wikilink: { sourceMark: 'mdWikilink', preview: true },
  image: { sourceMark: 'mdImage', preview: true },
  file: { sourceMark: 'mdFile', preview: true },
} as const satisfies Record<string, UnitKind>

export type UnitKindKey = keyof typeof UNIT_KINDS

const kindEntries = Object.entries(UNIT_KINDS) as Array<[UnitKindKey, UnitKind]>

// Marks covering a whole source unit, emitted as one replacement per unit by
// text projections.
export const ATOM_MARK_NAMES: ReadonlySet<string> = new Set(
  kindEntries.flatMap(([, kind]) => (kind.sourceMark ? [kind.sourceMark] : [])),
)

// Pack keys of the units whose source hides behind a rendered preview. The
// focus reveal skips these packs: revealing them shows nothing, and matching
// one would shadow a revealable neighbour on the other side of the caret.
export const ATOM_PACK_KEYS: ReadonlySet<string> = new Set(
  kindEntries.flatMap(([key, kind]) => (kind.preview ? [key] : [])),
)

// The source marks whose mark views hide the raw text behind a rendered
// preview (`.md-atom-view-preview`) and act as one caret stop.
export const ATOM_SOURCE_MARK_NAMES: readonly MarkName[] = kindEntries.flatMap(([, kind]) =>
  kind.preview && kind.sourceMark ? [kind.sourceMark] : [],
)
