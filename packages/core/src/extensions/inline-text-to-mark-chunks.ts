import type { Mark } from '@prosekit/pm/model'

import { hostFromUrl, isLinkableBareHost } from '../lezer/autolink-tld.ts'
import type { InlineElement } from '../lezer/inline.ts'
import { parseInline } from '../lezer/inline.ts'
import { LEZER_NODE_IDS } from '../lezer/node-ids.ts'

import type { MdLinkTextAttrs, MdPackAttrs, MdPackSimpleKey } from './inline-marks.ts'
import { parseMagicComment, type MagicComment } from './magic-comment.ts'
import type { MarkChunk } from './mark-chunk.ts'
import type { MarkName } from './mark-names.ts'
import { marksEqual } from './marks-equal.ts'
import type { TypedMarkBuilders } from './schema.ts'
import { parseWikilink } from './wikilink.ts'

/**
 * Lookup from Lezer node type id to the ProseMirror mark.
 *
 * Notable absences:
 * - `Link` / `Image` / `Autolink` are wrapper nodes; their syntax
 *   characters are emitted by inner `LinkMark` / `URL` children and
 *   handled here. Link text gets `mdLinkText` via `walkLink`.
 * - `Escape` / `Entity` / `HardBreak` / `HTMLTag` / `LinkLabel` /
 *   `Comment` etc. produce no mark for now - they render as plain text.
 */
const MARK_NAME_BY_TYPE_ID: ReadonlyMap<number, MarkName> = new Map([
  [LEZER_NODE_IDS.Emphasis, 'mdEm'],
  [LEZER_NODE_IDS.StrongEmphasis, 'mdStrong'],
  [LEZER_NODE_IDS.InlineCode, 'mdCode'],
  [LEZER_NODE_IDS.Strikethrough, 'mdDel'],
  [LEZER_NODE_IDS.Highlight, 'mdHighlight'],
  [LEZER_NODE_IDS.EmphasisMark, 'mdMark'],
  [LEZER_NODE_IDS.CodeMark, 'mdMark'],
  [LEZER_NODE_IDS.LinkMark, 'mdMark'],
  [LEZER_NODE_IDS.StrikethroughMark, 'mdMark'],
  [LEZER_NODE_IDS.HighlightMark, 'mdMark'],
  [LEZER_NODE_IDS.URL, 'mdLinkUri'],
  [LEZER_NODE_IDS.LinkTitle, 'mdLinkTitle'],
  [LEZER_NODE_IDS.Hashtag, 'mdTag'],
  [LEZER_NODE_IDS.WikilinkMark, 'mdMark'],
])

/**
 * Walk a textblock's inline content and produce a list of mark chunks
 * with positions relative to the start of `text` (i.e. zero-based).
 * Callers shift the chunks into the document's coordinate space.
 */
export function inlineTextToMarkChunks(
  /** Typed mark builders bound to the target schema. */
  marks: TypedMarkBuilders,
  /** The raw inline text of one textblock (no block prefix). */
  text: string,
): MarkChunk[] {
  const elements = parseInline(text)
  const out: MarkChunk[] = []
  walk(elements, [], 0, text.length, text, marks, out)
  return out
}

// TODO: move function getAutolinkHref into lezer/autolink-tld.ts

/**
 * Derive the `href` for a bare autolink from its visible text:
 *
 * - a URL with a scheme is used as-is
 * - an email becomes `mailto:`
 * - a `www.` URL gets an implied `https://`
 * - a bare domain on the curated TLD list gets an implied `https://`
 * - anything else returns `undefined`
 */
export function getAutolinkHref(urlText: string): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(urlText)) return urlText
  if (/^[^\s@]+@[^\s@]+$/.test(urlText)) return `mailto:${urlText}`
  if (/^www\./i.test(urlText)) return `https://${urlText}`
  if (isLinkableBareHost(hostFromUrl(urlText))) return `https://${urlText}`
  return undefined
}

/** Drop the surrounding `"" '' ()` delimiters of a `LinkTitle` slice and unescape. */
function unquoteTitle(raw: string): string {
  return raw.slice(1, -1).replaceAll(/\\(.)/g, '$1')
}

function walk(
  nodes: readonly InlineElement[],
  parentMarks: readonly Mark[],
  rangeStart: number,
  rangeEnd: number,
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
): void {
  let pos = rangeStart
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]
    if (node.from > pos) {
      emit(out, pos, node.from, parentMarks)
    }
    const type: number = node.type
    if (type === LEZER_NODE_IDS.Link) {
      walkLink(node, parentMarks, text, marks, out)
    } else if (type === LEZER_NODE_IDS.Image) {
      const trailing = takeMagicComment(node, nodes[index + 1], text)
      walkImage(node, parentMarks, text, marks, out, trailing)
      if (trailing) index++ // skip the folded comment
      pos = trailing ? trailing.to : node.to
      continue
    } else if (type === LEZER_NODE_IDS.Wikilink) {
      walkWikilink(node, parentMarks, text, marks, out)
    } else if (type === LEZER_NODE_IDS.URL) {
      // A standalone `URL` node is a GFM autolink (the address part of a real
      // `[text](url)` is handled inside `walkLink`, not here). Linkify the
      // shapes we recognize; anything else keeps the muted `mdLinkUri`.
      const href = getAutolinkHref(text.slice(node.from, node.to))
      const mark: Mark = href
        ? marks.mdLinkText.create({ href } satisfies MdLinkTextAttrs)
        : marks.mdLinkUri.create()
      emit(out, node.from, node.to, [...parentMarks, mark])
    } else {
      let packKey: MdPackSimpleKey | undefined

      if (type === LEZER_NODE_IDS.Emphasis) {
        packKey = 'italic'
      } else if (type === LEZER_NODE_IDS.StrongEmphasis) {
        packKey = 'bold'
      } else if (type === LEZER_NODE_IDS.InlineCode) {
        packKey = 'code'
      } else if (type === LEZER_NODE_IDS.Strikethrough) {
        packKey = 'strike'
      } else if (type === LEZER_NODE_IDS.Highlight) {
        packKey = 'highlight'
      } else if (type === LEZER_NODE_IDS.Autolink) {
        packKey = 'autolink'
      }

      const base = packKey
        ? [...parentMarks, marks.mdPack.create({ key: packKey } satisfies MdPackAttrs)]
        : parentMarks
      const maybeMarkName = MARK_NAME_BY_TYPE_ID.get(type)
      const childMarks = maybeMarkName ? [...base, marks[maybeMarkName].create()] : base
      if (node.children.length === 0) {
        emit(out, node.from, node.to, childMarks)
      } else {
        walk(node.children, childMarks, node.from, node.to, text, marks, out)
      }
    }
    pos = node.to
  }
  if (pos < rangeEnd) {
    emit(out, pos, rangeEnd, parentMarks)
  }
}

/**
 * Special walker for `Link` nodes.
 *
 * Lezer's flat child list looks like:
 *   LinkMark `[` (or `![`), [label children + implicit gaps], LinkMark `]`,
 *   LinkMark `(`, URL, optional LinkTitle, LinkMark `)`.
 *
 * We first scan to locate the second `LinkMark` (the `]` that closes
 * the label) and any `URL` node. Everything in the label range gets an
 * extra `mdLinkText({ href })` mark; everything outside it falls
 * through the regular per-child mark mapping (LinkMark -> mdMark,
 * URL -> mdLinkUri).
 *
 * For Autolink / malformed link with no `]`, `labelEnd` stays at -1
 * and the link-text logic stays inert - the walker still emits the
 * outer syntax marks correctly.
 */
function walkLink(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
): void {
  let labelEnd = -1
  let urlNode: InlineElement | null = null
  let titleNode: InlineElement | null = null
  let bracketCount = 0
  for (const child of node.children) {
    if (child.type === LEZER_NODE_IDS.LinkMark) {
      bracketCount++
      if (bracketCount === 2) labelEnd = child.from
    } else if (child.type === LEZER_NODE_IDS.URL && urlNode === null) {
      urlNode = child
    } else if (child.type === LEZER_NODE_IDS.LinkTitle && titleNode === null) {
      titleNode = child
    }
  }
  const href = urlNode ? text.slice(urlNode.from, urlNode.to) : ''
  const title = titleNode ? unquoteTitle(text.slice(titleNode.from, titleNode.to)) : ''
  const linkTextMark = href ? marks.mdLinkText.create({ href } satisfies MdLinkTextAttrs) : null
  const inLabel = (pos: number): boolean => labelEnd >= 0 && pos < labelEnd && linkTextMark !== null

  const pack = marks.mdPack.create({ key: 'link', data: { href, title } } satisfies MdPackAttrs)
  const base = [...parentMarks, pack]

  let pos = node.from
  for (const child of node.children) {
    if (child.from > pos) {
      const childMarks = inLabel(pos) ? [...base, linkTextMark!] : base
      emit(out, pos, child.from, childMarks)
    }
    const baseForChild = inLabel(child.from) ? [...base, linkTextMark!] : base
    // A wikilink in the label needs its own source/view walk, not the generic
    // per-child mark mapping.
    if (child.type === LEZER_NODE_IDS.Wikilink) {
      walkWikilink(child, baseForChild, text, marks, out)
      pos = child.to
      continue
    }
    const maybeMarkName = MARK_NAME_BY_TYPE_ID.get(child.type)
    const childMarks = maybeMarkName
      ? [...baseForChild, marks[maybeMarkName].create()]
      : baseForChild
    if (child.children.length === 0) {
      emit(out, child.from, child.to, childMarks)
    } else {
      walk(child.children, childMarks, child.from, child.to, text, marks, out)
    }
    pos = child.to
  }
  if (pos < node.to) {
    emit(out, pos, node.to, base)
  }
}

interface AdjacentMagicComment {
  magic: MagicComment
  to: number
}

// A magic comment sitting immediately after `image`, or undefined.
function takeMagicComment(
  image: InlineElement,
  next: InlineElement | undefined,
  text: string,
): AdjacentMagicComment | undefined {
  if (!next || next.type !== LEZER_NODE_IDS.Comment || next.from !== image.to) return undefined
  const magic = parseMagicComment(text.slice(next.from, next.to))
  if (!magic) return undefined
  return { magic, to: next.to }
}

/**
 * Special walker for a direct image `![alt](url)`.
 *
 * A `trailing` magic comment immediately after the image (e.g.
 * `<!-- {"width":320} -->`) is folded into the mark range so it round-trips as
 * source while supplying the image's `width`.
 */
function walkImage(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
  trailing?: AdjacentMagicComment,
): void {
  const urlNode = node.children.find((child) => child.type === LEZER_NODE_IDS.URL)
  if (!urlNode) {
    // A reference image `![alt][id]` has no `URL` child; fall back to the link
    // walk, which renders nothing yet.
    walkLink(node, parentMarks, text, marks, out)
    return
  }

  const bracketNodes = node.children.filter((child) => child.type === LEZER_NODE_IDS.LinkMark)
  const titleNode = node.children.find((child) => child.type === LEZER_NODE_IDS.LinkTitle)

  const src: string = text.slice(urlNode.from, urlNode.to)
  const alt: string =
    bracketNodes.length >= 2 ? text.slice(bracketNodes[0].to, bracketNodes[1].from) : ''
  const title: string = titleNode ? unquoteTitle(text.slice(titleNode.from, titleNode.to)) : ''
  const width = trailing?.magic.width ?? null
  const height = trailing?.magic.height ?? null
  const to = trailing?.to ?? node.to

  emit(out, node.from, to, [
    ...parentMarks,
    marks.mdImage.create({ src, alt, title, width, height }),
  ])
}

/**
 * Special walker for a wikilink `[[target]]`/`[[target|alias]]`.
 */
function walkWikilink(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
): void {
  const { target, display } = parseWikilink(text.slice(node.from, node.to))

  emit(out, node.from, node.to, [...parentMarks, marks.mdWikilink.create({ target, display })])
}

/**
 * Push `[from, to, marks]` to `out`, coalescing with the previous chunk
 * when both share the same mark set. Coalescing keeps the chunk list
 * short, which matters for `BatchSetMarkStep.apply`'s per-chunk diff.
 */
function emit(out: MarkChunk[], from: number, to: number, marks: readonly Mark[]): void {
  if (from >= to) {
    // Should not happen.
    return
  }

  const last = out.at(-1)
  if (last && last[1] === from && marksEqual(last[2], marks)) {
    out[out.length - 1] = [last[0], to, last[2]]
    return
  }
  out.push([from, to, marks])
}
