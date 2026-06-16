import type { Mark, Schema } from '@prosekit/pm/model'

import type { InlineElement } from '../lezer/inline.ts'
import { parseInline } from '../lezer/inline.ts'
import { LEZER_NODE_IDS } from '../lezer/node-ids.ts'

import type { MarkName } from './inline-marks.ts'
import type { MarkChunk } from './mark-chunk.ts'
import { marksEqual } from './marks-equal.ts'

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
  [LEZER_NODE_IDS.Wikilink, 'mdWikilink'],
  [LEZER_NODE_IDS.WikilinkMark, 'mdMark'],
])

/**
 * Walk a textblock's inline content and produce a list of mark chunks
 * with positions relative to the start of `text` (i.e. zero-based).
 * Callers shift the chunks into the document's coordinate space.
 */
export function inlineTextToMarkChunks(
  /** ProseMirror schema with our inline marks defined. */
  schema: Schema,
  /** The raw inline text of one textblock (no block prefix). */
  text: string,
): MarkChunk[] {
  const elements = parseInline(text)
  const out: MarkChunk[] = []
  walk(elements, [], 0, text.length, text, schema, out)
  return out
}

/**
 * Derive the `href` for a bare autolink from its visible text: a URL with a
 * scheme is used as-is; an email becomes `mailto:`; a `www.` URL gets an
 * implied `https://`. Returns `undefined` for anything else.
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
  schema: Schema,
  out: MarkChunk[],
): void {
  let pos = rangeStart
  for (const node of nodes) {
    if (node.from > pos) {
      emit(out, pos, node.from, parentMarks)
    }
    if (node.type === LEZER_NODE_IDS.Link || node.type === LEZER_NODE_IDS.Image) {
      walkLink(node, parentMarks, text, schema, out)
    } else if (node.type === LEZER_NODE_IDS.URL) {
      // A standalone `URL` node is a GFM autolink (the address part of a real
      // `[text](url)` is handled inside `walkLink`, not here). Linkify the
      // shapes we recognize; anything else keeps the muted `mdLinkUri`.
      const href = getAutolinkHref(text.slice(node.from, node.to))
      // TODO: replace the stringly-typed `schema.marks[name].create()` pattern
      // in this file with typed mark creation threaded through `walk`.
      const mark = href ? schema.marks.mdLinkText.create({ href }) : schema.marks.mdLinkUri.create()
      emit(out, node.from, node.to, [...parentMarks, mark])
    } else {
      const maybeMarkName = MARK_NAME_BY_TYPE_ID.get(node.type)
      const childMarks = maybeMarkName
        ? [...parentMarks, schema.marks[maybeMarkName].create()]
        : parentMarks
      if (node.children.length === 0) {
        emit(out, node.from, node.to, childMarks)
      } else {
        walk(node.children, childMarks, node.from, node.to, text, schema, out)
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
  schema: Schema,
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
  const linkTextMark =
    href && schema.marks.mdLinkText ? schema.marks.mdLinkText.create({ href }) : null
  const inLabel = (pos: number): boolean => labelEnd >= 0 && pos < labelEnd && linkTextMark !== null

  let pos = node.from
  for (const child of node.children) {
    if (child.from > pos) {
      const marks = inLabel(pos) ? [...parentMarks, linkTextMark!] : parentMarks
      emit(out, pos, child.from, marks)
    }
    const baseForChild = inLabel(child.from) ? [...parentMarks, linkTextMark!] : parentMarks
    const maybeMarkName = MARK_NAME_BY_TYPE_ID.get(child.type)
    const childMarks = maybeMarkName
      ? [...baseForChild, schema.marks[maybeMarkName].create()]
      : baseForChild
    if (child.children.length === 0) {
      emit(out, child.from, child.to, childMarks)
    } else {
      walk(child.children, childMarks, child.from, child.to, text, schema, out)
    }
    pos = child.to
  }
  if (pos < node.to) {
    emit(out, pos, node.to, parentMarks)
  }
}

/**
 * Push `[from, to, marks]` to `out`, coalescing with the previous chunk
 * when both share the same mark set. Coalescing keeps the chunk list
 * short, which matters for `BatchSetMarkStep.apply`'s per-chunk diff.
 */
function emit(out: MarkChunk[], from: number, to: number, marks: readonly Mark[]): void {
  if (from >= to) return
  const last = out.at(-1)
  if (last && last[1] === from && marksEqual(last[2], marks)) {
    out[out.length - 1] = [last[0], to, last[2]]
    return
  }
  out.push([from, to, marks])
}
