import { defineMarkSpec, union } from '@prosekit/core'

import {
  FILE_MARK_CLASS,
  IMAGE_MARK_CLASS,
  LINK_TEXT_MARK_CLASS,
  LINK_TITLE_MARK_CLASS,
  LINK_URI_MARK_CLASS,
  MATH_MARK_CLASS,
  PACK_MARK_CLASS,
  SYNTAX_MARK_CLASS,
  TAG_MARK_CLASS,
  WIKILINK_MARK_CLASS,
} from '../class-names.ts'
import { NON_PROSE_ATTRS } from '../utils/non-prose-attrs.ts'

import type { MarkName } from './mark-names.ts'

/**
 * Attributes of the `mdImage` mark, derived from either `![alt](src "title")`
 * (plus an optional trailing size comment) or a resolved wiki image embed.
 */
export interface MdImageAttrs {
  /**
   * The image destination, exactly as written in the source.
   */
  src: string
  /**
   * The image alt text.
   */
  alt: string
  /**
   * The image title, or `''` when the source has none.
   */
  title: string
  /**
   * Display width in CSS pixels from the trailing comment, or `null`.
   */
  width: number | null
  /**
   * Display height in CSS pixels from the trailing comment, or `null`.
   */
  height: number | null
  /**
   * The saved post-embed snapshot from the trailing comment, or `null`.
   */
  snapshot: object | null
  /**
   * `wikiEmbed` when the source is `![[target]]`; otherwise `null`.
   */
  syntax: 'wikiEmbed' | null
  /**
   * Original wiki-embed target used when persisting a resized image, or `null`.
   */
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
      snapshot: { default: null },
      syntax: { default: null },
      wikiTarget: { default: null },
    },
    toDOM: () => ['span', { class: IMAGE_MARK_CLASS }, 0],
    parseDOM: [{ tag: `span.${IMAGE_MARK_CLASS}` }],
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
    toDOM: () => ['span', { class: SYNTAX_MARK_CLASS }, 0],
    parseDOM: [{ tag: `span.${SYNTAX_MARK_CLASS}` }],
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
    toDOM: () => ['code', { ...NON_PROSE_ATTRS }, 0],
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
    toDOM: (mark) => [
      'a',
      { class: LINK_TEXT_MARK_CLASS, href: (mark.attrs as MdLinkTextAttrs).href },
      0,
    ],
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
    toDOM: () => ['span', { class: LINK_URI_MARK_CLASS, ...NON_PROSE_ATTRS }, 0],
    parseDOM: [{ tag: `span.${LINK_URI_MARK_CLASS}` }],
  })
}

function defineMdLinkTitle() {
  return defineMarkSpec({
    name: 'mdLinkTitle' satisfies MarkName,
    inclusive: false,
    toDOM: () => ['span', { class: LINK_TITLE_MARK_CLASS }, 0],
    parseDOM: [{ tag: `span.${LINK_TITLE_MARK_CLASS}` }],
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
    toDOM: () => ['span', { class: TAG_MARK_CLASS }, 0],
    parseDOM: [{ tag: `span.${TAG_MARK_CLASS}` }],
  })
}

/**
 * Covers the whole `[[...]]` source.
 */
function defineMdWikilink() {
  return defineMarkSpec<'mdWikilink', MdWikilinkAttrs>({
    name: 'mdWikilink' satisfies MarkName,
    inclusive: false,
    attrs: { target: { default: '' }, display: { default: '' } },
    toDOM: () => ['span', { class: WIKILINK_MARK_CLASS }, 0],
    parseDOM: [{ tag: `span.${WIKILINK_MARK_CLASS}` }],
  })
}

export interface MdWikilinkAttrs {
  /**
   * Target passed to click and hover handlers: the bracketed text unless the
   * host's `resolveWikilink` replaced it.
   */
  target: string
  /**
   * Label shown in place of the source, or `''` to show the target.
   */
  display: string
}

/**
 * Attributes of the `mdFile` mark: a whole `[label](url)` link that the host's
 * `resolveFileLink` claimed as a file attachment, rendered as a file pill.
 */
export interface MdFileAttrs {
  /**
   * The link destination, exactly as written in the source.
   */
  href: string
  /**
   * The display name: the raw label slice, or the `href` basename when the label is empty.
   */
  name: string
  /**
   * The link title, or `''` when the source has none.
   */
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
    toDOM: () => ['span', { class: FILE_MARK_CLASS }, 0],
    parseDOM: [{ tag: `span.${FILE_MARK_CLASS}` }],
  })
}

/**
 * Attributes of the `mdMath` mark: a whole `$formula$` / `$$formula$$` inline
 * math expression, rendered by `MathMarkView`.
 */
export interface MdMathAttrs {
  /**
   * The TeX source between the dollar delimiters.
   */
  formula: string
}

/**
 * Covers the whole `$formula$` source, dollars included.
 */
function defineMdMath() {
  return defineMarkSpec<'mdMath', MdMathAttrs>({
    name: 'mdMath' satisfies MarkName,
    inclusive: false,
    attrs: { formula: { default: '' } },
    toDOM: () => ['span', { class: MATH_MARK_CLASS }, 0],
    parseDOM: [{ tag: `span.${MATH_MARK_CLASS}` }],
  })
}

/**
 * Content-derived identity of one inline syntax unit.
 *
 * - `key`: the unit's kind. It keeps adjacent same-kind units apart and stays
 *   stable when unrelated text in the block is edited, so editing one unit
 *   never re-marks the others.
 * - `data`: the unit's parsed data, read off the mark instead of
 *   re-parsing the text.
 * - `slot`: `1` when the pack would otherwise equal the pack of the unit
 *   ending exactly where this one starts; equal packs would merge the two
 *   units into one mark run and one mark view.
 * - `revealInFocus`/`revealInHide`: the mark modes in which the unit's
 *   source reveals around the caret.
 */
export type MdPackAttrs =
  | {
      key: 'italic' | 'bold' | 'code' | 'del' | 'highlight'
      data?: null | undefined
      slot?: 1 | null | undefined
      revealInFocus: true
      revealInHide?: null | undefined
    }
  | {
      key: 'link-inline' | 'link-reference'
      data: { href: string; title: string }
      slot?: 1 | null | undefined
      revealInFocus: true
      revealInHide?: null | undefined
    }
  | {
      key: 'link-angle'
      data: { href: string }
      slot?: 1 | null | undefined
      revealInFocus: true
      revealInHide?: null | undefined
    }
  | {
      // A bare autolink (`https://a.com`, `www.a.com`, `a@b.com`) is all
      // visible content with no hidden syntax, so no mode reveals it; the
      // pack only carries the resolved `href`.
      key: 'link-bare'
      data: { href: string }
      slot?: 1 | null | undefined
      revealInFocus?: null | undefined
      revealInHide?: null | undefined
    }
  | {
      // A URL opted out of autolinking by a trailing `<!-- {"noLink":true} -->`
      // magic comment (written by `removeLink`): the address is plain visible
      // text, and the comment is hidden syntax revealed in focus so it can be
      // edited in place.
      key: 'noLink'
      data?: null | undefined
      slot?: 1 | null | undefined
      revealInFocus: true
      revealInHide?: null | undefined
    }
  | {
      // Math hides the formula source (not just syntax) behind its preview,
      // so it also reveals in hide mode; otherwise it could not be edited in
      // place there.
      key: 'math'
      data?: null | undefined
      slot?: 1 | null | undefined
      revealInFocus: true
      revealInHide: true
    }
  | {
      // A preview unit reveals in no mode: its source hides behind the
      // preview, so revealing it would change nothing visible.
      key: 'wikilink' | 'image' | 'file'
      data?: null | undefined
      slot?: 1 | null | undefined
      revealInFocus?: null | undefined
      revealInHide?: null | undefined
    }

/**
 * Wraps a whole inline unit. For a revealable unit (emphasis, strong, code,
 * strikethrough, inline and angle link, math) focus mode reveals the unit
 * with one range lookup instead of stitching its punctuation back together;
 * a unit that never reveals (wikilink, image, file, bare autolink) carries
 * it as unit identity. `excludes: ''` lets nested units carry two of these
 * marks at once.
 */
function defineMdPack() {
  return defineMarkSpec<'mdPack', MdPackAttrs>({
    name: 'mdPack' satisfies MarkName,
    excludes: '',
    inclusive: false,
    attrs: {
      key: {},
      data: { default: null },
      slot: { default: null },
      revealInFocus: { default: null },
      revealInHide: { default: null },
    },
    toDOM: (mark) => {
      const attrs = mark.attrs as MdPackAttrs
      return ['span', { class: PACK_MARK_CLASS, 'data-key': attrs.key }, 0]
    },
    parseDOM: [{ tag: `span.${PACK_MARK_CLASS}` }],
  })
}

export function defineInlineMarks() {
  // The last mark registered gets the lowest rank and becomes the outermost DOM
  // wrapper, so `mdWikilink`/`mdImage` go near the end: each covers a whole
  // wikilink/image source that a mark view renders. The `mdMark` goes last of
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
