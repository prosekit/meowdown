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
 * hides in hide/focus mode so the rendered image replaces the raw syntax.
 */
function defineMdImageSource() {
  return defineMarkSpec({
    name: 'mdImageSource' satisfies MarkName,
    inclusive: false,
    toDOM: () => ['span', { class: 'md-image-source' }, 0],
    parseDOM: [{ tag: 'span.md-image-source' }],
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
    toDOM: (mark) => ['a', { href: (mark.attrs as MdLinkTextAttrs).href }, 0],
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

function defineMdDel() {
  return defineMarkSpec({
    name: 'mdDel' satisfies MarkName,
    toDOM: () => ['del', 0],
    parseDOM: [{ tag: 'del' }],
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
 * Covers the whole `[[target]]`; the `[[` `]]` brackets also carry
 * `mdMark` (they are removable syntax, unlike a tag's `#`).
 */
function defineMdWikilink() {
  return defineMarkSpec({
    name: 'mdWikilink' satisfies MarkName,
    inclusive: false,
    toDOM: () => ['span', { class: 'md-wikilink' }, 0],
    parseDOM: [{ tag: 'span.md-wikilink' }],
  })
}

export function defineInlineMarks() {
  // The last mark registered here gets the lowest rank and becomes the outermost DOM wrapper.

  return union(
    defineMdMark(),
    defineMdEm(),
    defineMdStrong(),
    defineMdCode(),
    defineMdLinkText(),
    defineMdLinkUri(),
    defineMdDel(),
    defineMdTag(),
    defineMdWikilink(),

    // The image marks are registered last so the preview (mdImageView) wraps the
    // source (mdImageSource), which wraps the syntax marks.
    defineMdImageSource(),
    defineMdImageView(),
  )
}
