import { defineMarkSpec, union } from '@prosekit/core'

import type { MarkName } from './mark-names.ts'

/**
 * Attributes of the `mdImage` mark, derived from either `![alt](src "title")`
 * (plus an optional trailing size comment) or a resolved wiki image embed.
 */
export interface MdImageAttrs {
  /** The image destination, exactly as written in the source. */
  src: string
  /** The image alt text. */
  alt: string
  /** The image title, or `''` when the source has none. */
  title: string
  /** Display width in CSS pixels from the trailing comment, or `null`. */
  width: number | null
  /** Display height in CSS pixels from the trailing comment, or `null`. */
  height: number | null
  /** `wikiEmbed` when the source is `![[target]]`; otherwise `null`. */
  syntax: 'wikiEmbed' | null
  /** Original wiki-embed target used when persisting a resized image, or `null`. */
  wikiTarget: string | null
}

function defineMdImage() {
  return defineMarkSpec<'mdImage', MdImageAttrs>({
    name: 'mdImage' satisfies MarkName,
    inclusive: false,
    attrs: {
      src: { default: '' },
      alt: { default: '' },
      title: { default: '' },
      width: { default: null },
      height: { default: null },
      syntax: { default: null },
      wikiTarget: { default: null },
    },
    toDOM: () => ['span', { class: 'md-image' }, 0],
    parseDOM: [{ tag: 'span.md-image' }],
  })
}

/**
 * Syntax characters: `*`, `_`, `` ` ``, `[`, `]`, `(`, `)`, `~`
 */
function defineMdMark() {
  return defineMarkSpec({
    name: 'mdMark' satisfies MarkName,
    // `inclusive: false` so typing right after a mark boundary does not extend the mark
    inclusive: false,
    toDOM: () => ['span', { class: 'md-mark' }, 0],
    parseDOM: [{ tag: 'span.md-mark' }],
  })
}

function defineMdEm() {
  return defineMarkSpec({
    name: 'mdEm' satisfies MarkName,
    toDOM: () => ['em', 0],
    parseDOM: [{ tag: 'em' }],
  })
}

function defineMdStrong() {
  return defineMarkSpec({
    name: 'mdStrong' satisfies MarkName,
    toDOM: () => ['strong', 0],
    parseDOM: [{ tag: 'strong' }],
  })
}

function defineMdCode() {
  return defineMarkSpec({
    name: 'mdCode' satisfies MarkName,
    toDOM: () => ['code', 0],
    parseDOM: [{ tag: 'code' }],
  })
}

export interface MdLinkTextAttrs {
  href: string
}

function defineMdLinkText() {
  return defineMarkSpec<'mdLinkText', MdLinkTextAttrs>({
    name: 'mdLinkText' satisfies MarkName,
    inclusive: false,
    attrs: { href: { default: '' } },
    toDOM: (mark) => ['a', { class: 'md-link', href: (mark.attrs as MdLinkTextAttrs).href }, 0],
    parseDOM: [
      {
        tag: 'a',
        getAttrs: (node) => {
          const el = node
          return { href: el.getAttribute('href') ?? '' }
        },
      },
    ],
  })
}

function defineMdLinkUri() {
  return defineMarkSpec({
    name: 'mdLinkUri' satisfies MarkName,
    inclusive: false,
    toDOM: () => ['span', { class: 'md-link-uri' }, 0],
    parseDOM: [{ tag: 'span.md-link-uri' }],
  })
}

function defineMdLinkTitle() {
  return defineMarkSpec({
    name: 'mdLinkTitle' satisfies MarkName,
    inclusive: false,
    toDOM: () => ['span', { class: 'md-link-title' }, 0],
    parseDOM: [{ tag: 'span.md-link-title' }],
  })
}

function defineMdDel() {
  return defineMarkSpec({
    name: 'mdDel' satisfies MarkName,
    toDOM: () => ['del', 0],
    parseDOM: [{ tag: 'del' }],
  })
}

function defineMdHighlight() {
  return defineMarkSpec({
    name: 'mdHighlight' satisfies MarkName,
    toDOM: () => ['mark', 0],
    parseDOM: [{ tag: 'mark' }],
  })
}

/**
 * Covers the whole `#tag`, `#` included: the `#` is tag content, not
 * removable syntax, so it never carries `mdMark`.
 */
function defineMdTag() {
  return defineMarkSpec({
    name: 'mdTag' satisfies MarkName,
    toDOM: () => ['span', { class: 'md-tag' }, 0],
    parseDOM: [{ tag: 'span.md-tag' }],
  })
}

/** Covers the whole `[[target]]`/`[[target|alias]]` source. */
function defineMdWikilink() {
  return defineMarkSpec<'mdWikilink', MdWikilinkAttrs>({
    name: 'mdWikilink' satisfies MarkName,
    inclusive: false,
    attrs: { target: { default: '' }, display: { default: '' } },
    toDOM: () => ['span', { class: 'md-wikilink' }, 0],
    parseDOM: [{ tag: 'span.md-wikilink' }],
  })
}

export interface MdWikilinkAttrs {
  target: string
  display: string
}

/**
 * Attributes of the `mdFile` mark: a whole `[label](url)` link that the host's
 * `resolveFileLink` claimed as a file attachment, rendered as a file pill.
 */
export interface MdFileAttrs {
  /** The link destination, exactly as written in the source. */
  href: string
  /** The display name: the raw label slice, or the `href` basename when the label is empty. */
  name: string
  /** The link title, or `''` when the source has none. */
  title: string
}

function defineMdFile() {
  return defineMarkSpec<'mdFile', MdFileAttrs>({
    name: 'mdFile' satisfies MarkName,
    inclusive: false,
    attrs: {
      href: { default: '' },
      name: { default: '' },
      title: { default: '' },
    },
    toDOM: () => ['span', { class: 'md-file' }, 0],
    parseDOM: [{ tag: 'span.md-file' }],
  })
}

/**
 * Attributes of the `mdMath` mark: a whole `$formula$` / `$$formula$$` inline
 * math expression, rendered by `MathMarkView`.
 */
export interface MdMathAttrs {
  /** The TeX source between the dollar delimiters. */
  formula: string
}

/** Covers the whole `$formula$` source, dollars included. */
function defineMdMath() {
  return defineMarkSpec<'mdMath', MdMathAttrs>({
    name: 'mdMath' satisfies MarkName,
    inclusive: false,
    attrs: { formula: { default: '' } },
    toDOM: () => ['span', { class: 'md-math' }, 0],
    parseDOM: [{ tag: 'span.md-math' }],
  })
}

/** mdPack keys for units that store no extra data; the syntax marks carry it. */
export type MdPackSimpleKey =
  | 'bold'
  | 'italic'
  | 'code'
  | 'strike'
  | 'highlight'
  | 'autolink'
  | 'math'

/**
 * Content-derived identity of one inline syntax unit. Adjacent units of the
 * same kind are kept apart by it (so they do not merge into one mark run), and
 * it stays stable when unrelated text in the block is edited, so editing one
 * unit never re-marks the others. `data` carries the unit's parsed payload (a
 * link's `href`/`title`, an image's `src`) so callers read it off the mark
 * instead of re-parsing the text.
 */
export type MdPackAttrs =
  | {
      key: 'link'
      data: { href: string; title: string; reference?: true }
    }
  | {
      key: 'image'
      data: { src: string }
    }
  | {
      key: MdPackSimpleKey
      data?: null
    }

/**
 * Wraps a whole revealable inline unit (emphasis, strong, code, strikethrough,
 * link, autolink, image) so focus mode can reveal the unit with one
 * `getMarkRange` lookup instead of stitching its punctuation back together.
 * `excludes: ''` lets nested units carry two of these marks at once.
 */
function defineMdPack() {
  return defineMarkSpec<'mdPack', MdPackAttrs>({
    name: 'mdPack' satisfies MarkName,
    excludes: '',
    inclusive: false,
    attrs: { key: {}, data: { default: null } },
    toDOM: (mark) => {
      const attrs = mark.attrs as MdPackAttrs
      return ['span', { class: 'md-pack', 'data-key': attrs.key }, 0]
    },
    parseDOM: [{ tag: 'span.md-pack' }],
  })
}

export function defineInlineMarks() {
  // The last mark registered gets the lowest rank and becomes the outermost DOM
  // wrapper, so mdWikilink/mdImage go near the end: each covers a whole
  // wikilink/image source that a mark view renders. The pack mark goes last of
  // all, so it wraps the whole unit (including a mark view).
  return union(
    defineMdMark(),
    defineMdEm(),
    defineMdStrong(),
    defineMdCode(),
    defineMdLinkText(),
    defineMdLinkUri(),
    defineMdLinkTitle(),
    defineMdDel(),
    defineMdHighlight(),
    defineMdTag(),

    defineMdWikilink(),
    defineMdImage(),
    defineMdFile(),
    defineMdMath(),
    defineMdPack(),
  )
}
