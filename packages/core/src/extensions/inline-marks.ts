import { defineMarkSpec, union } from '@prosekit/core'

import type { MarkName } from './mark-names.ts'

/**
 * Anchors an inline image preview on the final character of `![alt](url)`. A
 * mark view (see `defineImage`) renders the image; without it the anchor char
 * just renders as text. Carries the parsed `src`/`alt`.
 */
function defineMdImageView() {
  return defineMarkSpec<'mdImageView', MdImageViewAttrs>({
    name: 'mdImageView' satisfies MarkName,
    inclusive: false,
    attrs: { src: { default: '' }, alt: { default: '' } },
    toDOM: () => ['span', { class: 'md-image-anchor' }, 0],
    parseDOM: [{ tag: 'span.md-image-anchor' }],
  })
}

export interface MdImageViewAttrs {
  src: string
  alt: string
}

/**
 * Covers the whole `![alt](url)` source. This is the mark `defineMarkMode`
 * hides in hide/focus mode so the rendered image replaces the raw syntax. The
 * `src`/`alt` attributes keep adjacent images distinct so their ranges stay
 * separate, and carry the parsed values so a click can resolve the image
 * without re-parsing the source.
 */
function defineMdImageSource() {
  return defineMarkSpec<'mdImageSource', MdImageSourceAttrs>({
    name: 'mdImageSource' satisfies MarkName,
    inclusive: false,
    attrs: { src: { default: '' }, alt: { default: '' } },
    toDOM: () => ['span', { class: 'md-image-source' }, 0],
    parseDOM: [{ tag: 'span.md-image-source' }],
  })
}

export interface MdImageSourceAttrs {
  src: string
  alt: string
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

/**
 * Covers the whole `[[target]]`/`[[target|alias]]` source. This is the mark
 * `defineMarkMode` hides in hide/focus mode so the rendered label replaces the
 * raw syntax. The `target` attribute keeps adjacent wikilinks distinct so their
 * ranges stay separate. The `[[` `]]` brackets also carry `mdMark` (removable
 * syntax, unlike a tag's `#`).
 */
function defineMdWikilinkSource() {
  return defineMarkSpec<'mdWikilinkSource', MdWikilinkSourceAttrs>({
    name: 'mdWikilinkSource' satisfies MarkName,
    inclusive: false,
    attrs: { target: { default: '' } },
    toDOM: () => ['span', { class: 'md-wikilink-source' }, 0],
    parseDOM: [{ tag: 'span.md-wikilink-source' }],
  })
}

export interface MdWikilinkSourceAttrs {
  target: string
}

/**
 * Anchors the rendered wikilink label on the final character of
 * `[[target]]`/`[[target|alias]]`. A mark view (see `defineWikilink`) renders the
 * non-editable label; without it the anchor char just renders as text. Carries
 * the parsed `target` and `display` (the alias, or empty when none).
 */
function defineMdWikilinkView() {
  return defineMarkSpec<'mdWikilinkView', MdWikilinkViewAttrs>({
    name: 'mdWikilinkView' satisfies MarkName,
    inclusive: false,
    attrs: { target: { default: '' }, display: { default: '' } },
    toDOM: () => ['span', { class: 'md-wikilink-anchor' }, 0],
    parseDOM: [{ tag: 'span.md-wikilink-anchor' }],
  })
}

export interface MdWikilinkViewAttrs {
  target: string
  display: string
}

/**
 * Content-derived identity of one inline syntax unit. Adjacent units of the
 * same kind are kept apart by it (so they do not merge into one mark run), and
 * it stays stable when unrelated text in the block is edited, so editing one
 * unit never re-marks the others.
 */
export type MdPackAttrs =
  | {
      key: 'link'
      data: { href: string; title?: string }
    }
  | {
      key: 'image'
      data: { src: string }
    }
  | {
      key: `bold` | `italic` | `code` | `strike` | `highlight` | `autolink`
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
  // wrapper, so the wikilink/image marks go last: the view mark (mdWikilinkView /
  // mdImageView) wraps the source, which wraps the syntax marks. The pack mark
  // goes last of all, so it wraps the whole unit (including a mark view).
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

    defineMdWikilinkSource(),
    defineMdWikilinkView(),
    defineMdImageSource(),
    defineMdImageView(),
    defineMdPack(),
  )
}
