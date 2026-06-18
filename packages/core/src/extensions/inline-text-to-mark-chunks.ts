import type { Mark } from '@prosekit/pm/model'

import type { InlineElement } from '../lezer/inline.ts'
import { parseInline } from '../lezer/inline.ts'
import { LEZER_NODE_IDS } from '../lezer/node-ids.ts'

import type {
  MdImageSourceAttrs,
  MdImageViewAttrs,
  MdLinkTextAttrs,
  MdWikilinkSourceAttrs,
  MdWikilinkViewAttrs,
} from './inline-marks.ts'
import type { MarkChunk } from './mark-chunk.ts'
import type { MarkName } from './mark-names.ts'
import { marksEqual } from './marks-equal.ts'
import type { TypedMarkBuilders } from './schema.ts'
import { parseWikilink } from './wikilink-click.ts'

/**
 * Lookup from Lezer node type id to the ProseMirror mark.
 *
 * Notable absences:
 * - `Link` / `Image` / `Autolink` are wrapper nodes; their syntax
 *   characters are emitted by inner `LinkMark` / `URL` children and
 *   handled here. Link text gets `mdLinkText` via `walkLink`.
 * - `Escape` / `Entity` / `HardBreak` / `HTMLTag` / `LinkTitle` /
 *   `LinkLabel` / `Comment` etc. produce no mark for now - they render
 *   as plain text.
 */
const MARK_NAME_BY_TYPE_ID: ReadonlyMap<number, MarkName> = new Map([
  [LEZER_NODE_IDS.Emphasis, 'mdEm'],
  [LEZER_NODE_IDS.StrongEmphasis, 'mdStrong'],
  [LEZER_NODE_IDS.InlineCode, 'mdCode'],
  [LEZER_NODE_IDS.Strikethrough, 'mdDel'],
  [LEZER_NODE_IDS.EmphasisMark, 'mdMark'],
  [LEZER_NODE_IDS.CodeMark, 'mdMark'],
  [LEZER_NODE_IDS.LinkMark, 'mdMark'],
  [LEZER_NODE_IDS.StrikethroughMark, 'mdMark'],
  [LEZER_NODE_IDS.URL, 'mdLinkUri'],
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

/**
 * Derive the `href` for a bare autolink from its visible text:
 *
 * - a URL with a scheme is used as-is
 * - an email becomes `mailto:`
 * - a `www.` URL gets an implied `https://`
 * - anything else returns `undefined`
 */
function getAutolinkHref(urlText: string): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(urlText)) return urlText
  if (/^[^\s@]+@[^\s@]+$/.test(urlText)) return `mailto:${urlText}`
  if (/^www\./i.test(urlText)) return `https://${urlText}`
  return undefined
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
  for (const node of nodes) {
    if (node.from > pos) {
      emit(out, pos, node.from, parentMarks)
    }
    if (node.type === LEZER_NODE_IDS.Link) {
      walkLink(node, parentMarks, text, marks, out)
    } else if (node.type === LEZER_NODE_IDS.Image) {
      walkImage(node, parentMarks, text, marks, out)
    } else if (node.type === LEZER_NODE_IDS.Wikilink) {
      walkWikilink(node, parentMarks, text, marks, out)
    } else if (node.type === LEZER_NODE_IDS.URL) {
      // A standalone `URL` node is a GFM autolink (the address part of a real
      // `[text](url)` is handled inside `walkLink`, not here). Linkify the
      // shapes we recognize; anything else keeps the muted `mdLinkUri`.
      const href = getAutolinkHref(text.slice(node.from, node.to))
      const mark = href
        ? marks.mdLinkText.create({ href } satisfies MdLinkTextAttrs)
        : marks.mdLinkUri.create()
      emit(out, node.from, node.to, [...parentMarks, mark])
    } else {
      const maybeMarkName = MARK_NAME_BY_TYPE_ID.get(node.type)
      const childMarks = maybeMarkName
        ? [...parentMarks, marks[maybeMarkName].create()]
        : parentMarks
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
 * Special walker for `Link` / `Image` nodes.
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
  let bracketCount = 0
  for (const child of node.children) {
    if (child.type === LEZER_NODE_IDS.LinkMark) {
      bracketCount++
      if (bracketCount === 2) labelEnd = child.from
    } else if (child.type === LEZER_NODE_IDS.URL && urlNode === null) {
      urlNode = child
    }
  }
  const href = urlNode ? text.slice(urlNode.from, urlNode.to) : ''
  const linkTextMark = href ? marks.mdLinkText.create({ href } satisfies MdLinkTextAttrs) : null
  const inLabel = (pos: number): boolean => labelEnd >= 0 && pos < labelEnd && linkTextMark !== null

  let pos = node.from
  for (const child of node.children) {
    if (child.from > pos) {
      const childMarks = inLabel(pos) ? [...parentMarks, linkTextMark!] : parentMarks
      emit(out, pos, child.from, childMarks)
    }
    const baseForChild = inLabel(child.from) ? [...parentMarks, linkTextMark!] : parentMarks
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
    emit(out, pos, node.to, parentMarks)
  }
}

/**
 * Special walker for a direct image `![alt](url)`.
 *
 * Emits `mdImageSource` across the whole node (the mark `defineMarkMode` hides)
 * and `mdImageView({ src, alt })` on the node's final character, which is the
 * anchor a mark view renders the inline image on. The final character is `)`
 * today and would be `]` for a future reference image `![alt][id]`, so the
 * anchor is `node.to - 1`, never a hardcoded `)`. `mdMark`/`mdLinkUri` style the
 * source for show mode; the alt carries no `mdLinkText` (it is not a link), but
 * inline emphasis inside it is still highlighted like any other syntax.
 */
function walkImage(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
): void {
  const urlNode = node.children.find((child) => child.type === LEZER_NODE_IDS.URL)
  if (!urlNode) {
    // A reference image `![alt][id]` has no `URL` child; fall back to the link
    // walk, which renders nothing yet.
    walkLink(node, parentMarks, text, marks, out)
    return
  }
  const brackets = node.children.filter((child) => child.type === LEZER_NODE_IDS.LinkMark)
  const src = text.slice(urlNode.from, urlNode.to)
  const alt = brackets.length >= 2 ? text.slice(brackets[0].to, brackets[1].from) : ''

  const source = marks.mdImageSource.create({ src, alt } satisfies MdImageSourceAttrs)
  const view = marks.mdImageView.create({ src, alt } satisfies MdImageViewAttrs)

  // The image's final character, where `mdImageView` is anchored: `)` today, a
  // future `]` for `![alt][id]`.
  const anchorFrom = node.to - 1

  // Marks shared by every chunk at `from`: `mdImageSource` over the whole
  // source, plus `mdImageView` once we reach the final character (the render
  // anchor). Each child layers its own syntax mark on top.
  const baseAt = (from: number): Mark[] =>
    from >= anchorFrom ? [...parentMarks, source, view] : [...parentMarks, source]

  let pos = node.from
  for (const child of node.children) {
    if (child.from > pos) {
      emit(out, pos, child.from, baseAt(pos))
    }
    const maybeMarkName = MARK_NAME_BY_TYPE_ID.get(child.type)
    const childMarks = maybeMarkName
      ? [...baseAt(child.from), marks[maybeMarkName].create()]
      : baseAt(child.from)
    if (child.children.length === 0) {
      emit(out, child.from, child.to, childMarks)
    } else {
      walk(child.children, childMarks, child.from, child.to, text, marks, out)
    }
    pos = child.to
  }
  if (pos < node.to) {
    emit(out, pos, node.to, baseAt(pos))
  }
}

/**
 * Special walker for a wikilink `[[target]]`/`[[target|alias]]`.
 *
 * Emits `mdWikilinkSource({ target })` across the whole node (the mark
 * `defineMarkMode` hides) and `mdWikilinkView({ target, display })` on the node's
 * final character, the anchor a mark view renders the non-editable label on. The
 * node's only children are the two `WikilinkMark` brackets (`[[` and `]]`); they
 * carry `mdMark` for show mode, and the target text between them carries only
 * `mdWikilinkSource`. The closing `]]` straddles the anchor, so it splits: the
 * final `]` also gets `mdWikilinkView`.
 */
function walkWikilink(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
): void {
  const { target, display } = parseWikilink(text.slice(node.from, node.to))
  const source = marks.mdWikilinkSource.create({ target } satisfies MdWikilinkSourceAttrs)
  const view = marks.mdWikilinkView.create({ target, display } satisfies MdWikilinkViewAttrs)
  const anchorFrom = node.to - 1

  let pos = node.from
  for (const child of node.children) {
    if (child.from > pos) {
      emit(out, pos, child.from, [...parentMarks, source])
    }
    if (child.from < anchorFrom) {
      emit(out, child.from, Math.min(child.to, anchorFrom), [
        ...parentMarks,
        source,
        marks.mdMark.create(),
      ])
    }
    if (child.to > anchorFrom) {
      emit(out, Math.max(child.from, anchorFrom), child.to, [
        ...parentMarks,
        source,
        view,
        marks.mdMark.create(),
      ])
    }
    pos = child.to
  }
  if (pos < node.to) {
    emit(out, pos, node.to, [...parentMarks, source])
  }
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
