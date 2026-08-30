import {
  getAutolinkHref,
  LEZER_NODE_IDS,
  parseInline,
  type InlineElement,
} from '@meowdown/markdown'
import type { Mark } from '@prosekit/pm/model'

import type { MdFileAttrs, MdLinkTextAttrs, MdMathAttrs, MdPackAttrs } from './inline-marks.ts'
import { parseMagicComment, type MagicComment } from './magic-comment.ts'
import type { MarkChunk } from './mark-chunk.ts'
import type { MarkName } from './mark-names.ts'
import { marksEqual } from './marks-equal.ts'
import {
  normalizeReferenceLabel,
  type ReferenceDefinition,
  type ReferenceDefinitions,
} from './reference-links.ts'
import type { TypedMarkBuilders } from './schema.ts'
import { parseWikiEmbed, wikiEmbedBasename, type WikiEmbedOptions } from './wiki-embed.ts'
import { parseWikilink } from './wikilink.ts'

/**
 * Lookup from Lezer node type id to the ProseMirror mark.
 *
 * Notable absences:
 * - `Link` / `Image` / `Autolink` are wrapper nodes; their syntax
 *   characters are emitted by inner `LinkMark` / `URL` children and
 *   handled here. Link text gets `mdLinkText` via `walkResolvedLink`.
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

// The pack key of a generic wrapper unit, or undefined for a marker or child
// node (they reach the generic walker too).
function getGenericPackKey(type: number) {
  switch (type) {
    case LEZER_NODE_IDS.Emphasis:
      return 'italic'
    case LEZER_NODE_IDS.StrongEmphasis:
      return 'bold'
    case LEZER_NODE_IDS.InlineCode:
      return 'code'
    case LEZER_NODE_IDS.Strikethrough:
      return 'del'
    case LEZER_NODE_IDS.Highlight:
      return 'highlight'
    default:
      return
  }
}

/**
 * What {@link FileLinkResolver} sees for one `[label](url)` link.
 */
export interface FileLinkPayload {
  /**
   * The link destination, exactly as written in the source.
   */
  href: string
  /**
   * The raw label slice between the brackets; may be empty or contain nested syntax.
   */
  label: string
  /**
   * The link title, or `''` when the source has none.
   */
  title: string
}

/**
 * Claims a `[label](url)` link as a file attachment. A claimed link carries a
 * single `mdFile` mark over its whole source (rendered as a file pill by
 * `defineFileView`) instead of the usual link marks, so link click/hover/menu
 * no longer apply to it. Must be pure: parse results are cached and diffed,
 * so the same input must always produce the same answer.
 */
export type FileLinkResolver = (link: FileLinkPayload) => boolean

/**
 * Host options that influence inline parsing.
 */
export interface FileLinkOptions {
  /**
   * Claim `[label](url)` links as file attachments; see {@link FileLinkResolver}.
   * Read once when the editor is created.
   */
  resolveFileLink?: FileLinkResolver
}

/**
 * Host options that influence source-backed inline atom parsing.
 */
export type InlineMarkOptions = FileLinkOptions & WikiEmbedOptions

export interface InlineMarkContext {
  /**
   * Effective document-wide definitions, keyed by normalized reference label.
   */
  referenceDefinitions?: ReferenceDefinitions
  /**
   * Prevent this definition block's own label from resolving as a shortcut reference.
   */
  isReferenceDefinition?: boolean
  /**
   * Receives every normalized key read by this block, including unresolved references.
   */
  referencedKeys?: Set<string>
}

/**
 * Walk a textblock's inline content and produce a list of mark chunks
 * with positions relative to the start of `text` (i.e. zero-based).
 * Callers shift the chunks into the document's coordinate space.
 */
export function inlineTextToMarkChunks(
  /**
   * Typed mark builders bound to the target schema.
   */
  marks: TypedMarkBuilders,
  /**
   * The raw inline text of one textblock (no block prefix).
   */
  text: string,
  /**
   * Host options; omit for the default parse.
   */
  options?: InlineMarkOptions,
): MarkChunk[] {
  return inlineTextToMarkChunksWithContext(marks, text, options)
}

export function inlineTextToMarkChunksWithContext(
  marks: TypedMarkBuilders,
  text: string,
  options?: InlineMarkOptions,
  context?: InlineMarkContext,
): MarkChunk[] {
  const elements = parseInline(text)
  const out: MarkChunk[] = []
  walk(elements, [], 0, text.length, text, marks, out, options, context)
  return out
}

/**
 * The pack of one unit starting at `from`. When the chunk ending exactly there
 * closes a unit whose pack equals this one, create it with `slot: 1` instead:
 * equal packs would let ProseMirror merge the two units into one text node,
 * one mark run and one mark view. The neighbour's own pack sits at the same
 * depth, right after `parentMarks`; at any other depth that position holds a
 * different mark (or nothing) and never compares equal.
 */
function createUnitPack(
  marks: TypedMarkBuilders,
  out: readonly MarkChunk[],
  parentMarks: readonly Mark[],
  from: number,
  attrs: MdPackAttrs,
): Mark {
  const pack = marks.mdPack.create(attrs)
  const previous = out.at(-1)
  if (previous == null || previous[1] !== from) return pack
  const neighbourPack = previous[2][parentMarks.length]
  if (neighbourPack == null || !neighbourPack.eq(pack)) return pack
  return marks.mdPack.create({ ...attrs, slot: 1 })
}

/**
 * Drop the surrounding `"" '' ()` delimiters of a `LinkTitle` slice and unescape.
 */
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
  options: InlineMarkOptions | undefined,
  context: InlineMarkContext | undefined,
): void {
  let pos = rangeStart
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]
    // A previous child may have consumed this one (e.g. an image folding its
    // trailing magic comments), so anything fully behind `pos` is done.
    if (node.to <= pos) continue
    if (node.from > pos) {
      emit(out, pos, node.from, parentMarks)
    }
    const atomEnd = walkAtomChild(nodes, index, parentMarks, text, marks, out, options, context)
    if (atomEnd != null) {
      pos = atomEnd
      continue
    }
    if (node.type === LEZER_NODE_IDS.URL) {
      const trailing = takeMagicComments(nodes, index, text)
      if (trailing?.magic.noLink) {
        walkUnlinkedURL(node, trailing, parentMarks, marks, out)
        pos = trailing.to
        continue
      }
    }
    walkNode(node, parentMarks, text, marks, out, options, context)
    pos = node.to
  }
  if (pos < rangeEnd) {
    emit(out, pos, rangeEnd, parentMarks)
  }
}

function walkNode(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
  options: InlineMarkOptions | undefined,
  context: InlineMarkContext | undefined,
): void {
  switch (node.type) {
    case LEZER_NODE_IDS.Link:
      return walkLink(node, parentMarks, text, marks, out, options, context)
    case LEZER_NODE_IDS.InlineMath:
      return walkMath(node, parentMarks, text, marks, out)
    case LEZER_NODE_IDS.Autolink:
      return walkAutolink(node, parentMarks, text, marks, out)
    case LEZER_NODE_IDS.URL:
      return walkURL(node, parentMarks, text, marks, out)
    default:
      return walkGenericNode(node, parentMarks, text, marks, out, options, context)
  }
}

/**
 * Walk `nodes[index]` when it is a source-backed atom (wikilink, wiki embed,
 * or image); returns the source position after everything the atom consumed,
 * or undefined for any other node type. An image also consumes the magic
 * comments chained behind it, so callers must skip children ending at or
 * before the returned position. Shared by `walk` and `walkResolvedLink` so an
 * atom behaves the same at the top level and inside a link label.
 */
function walkAtomChild(
  nodes: readonly InlineElement[],
  index: number,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
  options: InlineMarkOptions | undefined,
  context: InlineMarkContext | undefined,
): number | undefined {
  const node = nodes[index]
  switch (node.type) {
    case LEZER_NODE_IDS.Wikilink:
      walkWikilink(node, parentMarks, text, marks, out)
      return node.to
    case LEZER_NODE_IDS.WikiEmbed:
      walkWikiEmbed(node, parentMarks, text, marks, out, options)
      return node.to
    case LEZER_NODE_IDS.Image: {
      const trailing = takeMagicComments(nodes, index, text)
      walkImage(node, parentMarks, text, marks, out, options, context, trailing)
      return trailing ? trailing.to : node.to
    }
    default:
      return undefined
  }
}

/**
 * A node with no source-backed atom of its own: it contributes its `mdPack` and
 * syntax marks, then recurses into its children.
 */
function walkGenericNode(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
  options: InlineMarkOptions | undefined,
  context: InlineMarkContext | undefined,
): void {
  const packKey = getGenericPackKey(node.type)
  const packMark =
    packKey &&
    createUnitPack(marks, out, parentMarks, node.from, { key: packKey, revealInFocus: true })
  const base = packMark ? [...parentMarks, packMark] : parentMarks
  const maybeMarkName = MARK_NAME_BY_TYPE_ID.get(node.type)
  const childMarks = maybeMarkName ? [...base, marks[maybeMarkName].create()] : base
  if (node.children.length === 0) {
    emit(out, node.from, node.to, childMarks)
  } else {
    walk(node.children, childMarks, node.from, node.to, text, marks, out, options, context)
  }
}

/**
 * Special walker for an angle autolink `<url>`. The unit's `href` lives on
 * its pack, computed from the `URL` child (`''` when the address is not
 * linkable, in which case the URL keeps the muted `mdLinkUri`). The children
 * are only the `<`/`>` marks and the `URL`, consumed right here: the `URL`
 * is a component of this unit, never a unit of its own.
 */
function walkAutolink(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
): void {
  const urlNode = node.children.find((child) => child.type === LEZER_NODE_IDS.URL)
  const href = urlNode ? (getAutolinkHref(text.slice(urlNode.from, urlNode.to)) ?? '') : ''
  const base = [
    ...parentMarks,
    createUnitPack(marks, out, parentMarks, node.from, {
      key: 'link-angle',
      data: { href },
      revealInFocus: true,
    }),
  ]
  let pos = node.from
  for (const child of node.children) {
    if (child.from > pos) {
      emit(out, pos, child.from, base)
    }
    const childMark =
      child.type === LEZER_NODE_IDS.URL
        ? href
          ? marks.mdLinkText.create({ href } satisfies MdLinkTextAttrs)
          : marks.mdLinkUri.create()
        : marks.mdMark.create()
    emit(out, child.from, child.to, [...base, childMark])
    pos = child.to
  }
  if (pos < node.to) {
    emit(out, pos, node.to, base)
  }
}

/**
 * A `URL` node reaching this walker is a standalone GFM autolink: the address
 * part of a `[text](url)` link is consumed by `walkResolvedLink`, and an
 * angle autolink's URL by `walkAutolink`. Linkify the shapes we recognize,
 * packing each as its own unit; anything else keeps the muted `mdLinkUri`.
 */
function walkURL(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
): void {
  const href = getAutolinkHref(text.slice(node.from, node.to))
  if (!href) {
    emit(out, node.from, node.to, [...parentMarks, marks.mdLinkUri.create()])
    return
  }
  emit(out, node.from, node.to, [
    ...parentMarks,
    createUnitPack(marks, out, parentMarks, node.from, {
      key: 'link-bare',
      data: { href },
    }),
    marks.mdLinkText.create({ href } satisfies MdLinkTextAttrs),
  ])
}

/**
 * A URL followed directly by a `<!-- {"noLink":true} -->` magic comment
 * stays plain text instead of autolinking. The comment rides behind the
 * address as hidden syntax that reveals in focus, so it can be edited or
 * deleted in place.
 */
function walkUnlinkedURL(
  node: InlineElement,
  trailing: FoldedMagicComments,
  parentMarks: readonly Mark[],
  marks: TypedMarkBuilders,
  out: MarkChunk[],
): void {
  const base = [
    ...parentMarks,
    createUnitPack(marks, out, parentMarks, node.from, { key: 'noLink', revealInFocus: true }),
  ]
  emit(out, node.from, node.to, base)
  emit(out, node.to, trailing.to, [...base, marks.mdMark.create()])
}

function walkLink(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
  options: InlineMarkOptions | undefined,
  context: InlineMarkContext | undefined,
): void {
  const parts = scanLinkParts(node)
  const resolution = resolveLink(parts, text, context)
  if (resolution == null) {
    walkUnresolvedLink(node, parentMarks, text, marks, out, options, context)
    return
  }
  const fileMark = claimFileLink(parts, resolution, text, marks, options)
  if (fileMark) {
    emit(out, node.from, node.to, [
      ...parentMarks,
      createUnitPack(marks, out, parentMarks, node.from, { key: 'file' }),
      fileMark,
    ])
    return
  }
  walkResolvedLink(node, parts, resolution, parentMarks, text, marks, out, options, context)
}

interface LinkParts {
  /**
   * End of the `[` that opens the label, or -1 when there is no label.
   */
  labelFrom: number
  /**
   * Start of the `]` that closes the label, or -1 when the label never closes.
   */
  labelTo: number
  urlNode: InlineElement | null
  titleNode: InlineElement | null
  referenceLabelNode: InlineElement | null
  linkMarkCount: number
}

/**
 * Locate the pieces of a `Link` node in Lezer's flat child list:
 *   LinkMark `[`, [label children], LinkMark `]`, LinkMark `(`, URL,
 *   optional LinkTitle, LinkMark `)`.
 *
 * An autolink inside the label also emits a `URL` child, so only a `URL`
 * after the second `LinkMark` (the `]` closing the label) is the destination.
 */
function scanLinkParts(node: InlineElement): LinkParts {
  let labelFrom = -1
  let labelTo = -1
  let urlNode: InlineElement | null = null
  let titleNode: InlineElement | null = null
  let referenceLabelNode: InlineElement | null = null
  let bracketCount = 0
  let linkMarkCount = 0
  for (const child of node.children) {
    const childType = child.type
    if (childType === LEZER_NODE_IDS.LinkMark) {
      linkMarkCount++
      bracketCount++
      if (bracketCount === 1) labelFrom = child.to
      if (bracketCount === 2) labelTo = child.from
    } else if (urlNode == null && bracketCount >= 2 && childType === LEZER_NODE_IDS.URL) {
      urlNode = child
    } else if (titleNode == null && childType === LEZER_NODE_IDS.LinkTitle) {
      titleNode = child
    } else if (referenceLabelNode == null && childType === LEZER_NODE_IDS.LinkLabel) {
      referenceLabelNode = child
    }
  }
  return {
    labelFrom,
    labelTo,
    urlNode,
    titleNode,
    referenceLabelNode,
    linkMarkCount,
  }
}

interface ResolvedLink {
  href: string
  title: string
  isReference: boolean
}

function resolveLink(
  parts: LinkParts,
  text: string,
  context: InlineMarkContext | undefined,
): ResolvedLink | undefined {
  if (parts.linkMarkCount >= 3) {
    return {
      href: parts.urlNode == null ? '' : text.slice(parts.urlNode.from, parts.urlNode.to),
      title:
        parts.titleNode == null
          ? ''
          : unquoteTitle(text.slice(parts.titleNode.from, parts.titleNode.to)),
      isReference: false,
    }
  }

  if (parts.labelFrom < 0 || parts.labelTo < 0) return
  if (context?.isReferenceDefinition === true) return
  const visibleLabel = text.slice(parts.labelFrom, parts.labelTo)
  const explicitLabel =
    parts.referenceLabelNode == null
      ? visibleLabel
      : text.slice(parts.referenceLabelNode.from + 1, parts.referenceLabelNode.to - 1) ||
        visibleLabel
  const key = normalizeReferenceLabel(explicitLabel)
  if (key === '') return

  context?.referencedKeys?.add(key)
  const definition: ReferenceDefinition | undefined = context?.referenceDefinitions?.get(key)
  if (definition == null) return
  return { href: definition.href, title: definition.title, isReference: true }
}

function walkUnresolvedLink(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
  options: InlineMarkOptions | undefined,
  context: InlineMarkContext | undefined,
): void {
  const children = node.children.filter((child) => {
    return child.type !== LEZER_NODE_IDS.LinkMark && child.type !== LEZER_NODE_IDS.LinkLabel
  })
  walk(children, parentMarks, node.from, node.to, text, marks, out, options, context)
}

/**
 * The last path segment of `href` (query/hash stripped), decoded when possible.
 */
function hrefBasename(href: string): string {
  const path = href.split(/[?#]/, 1)[0]
  const segment = path.split(/[/\\]/).findLast(Boolean) ?? path
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * The `mdFile` mark for a whole inline or resolved reference link that the
 * host's `resolveFileLink` claimed as a file, or `undefined` when the link
 * stays a regular link. The resolver is never consulted for a link without a
 * closed label or a non-empty destination.
 */
function claimFileLink(
  parts: LinkParts,
  resolution: ResolvedLink,
  text: string,
  marks: TypedMarkBuilders,
  options: InlineMarkOptions | undefined,
): Mark | undefined {
  const resolveFileLink = options?.resolveFileLink
  if (!resolveFileLink) return undefined
  const { labelFrom, labelTo } = parts
  if (labelFrom < 0 || labelTo < 0) return undefined
  const { href, title } = resolution
  if (!href) return undefined
  const label = text.slice(labelFrom, labelTo)
  if (!resolveFileLink({ href, label, title })) return undefined
  const name = label || hrefBasename(href)
  return marks.mdFile.create({ href, name, title } satisfies MdFileAttrs)
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
function walkResolvedLink(
  node: InlineElement,
  parts: LinkParts,
  resolution: ResolvedLink,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
  options: InlineMarkOptions | undefined,
  context: InlineMarkContext | undefined,
): void {
  const { labelTo: labelEnd } = parts
  const { href, title, isReference } = resolution
  const linkTextMark = marks.mdLinkText.create({
    href,
  } satisfies MdLinkTextAttrs)
  const inLabel = (pos: number): boolean => labelEnd >= 0 && pos < labelEnd
  const pack = createUnitPack(marks, out, parentMarks, node.from, {
    key: isReference ? 'link-reference' : 'link-inline',
    data: { href, title },
    revealInFocus: true,
  })
  const base = [...parentMarks, pack]

  let pos = node.from
  for (let index = 0; index < node.children.length; index++) {
    const child = node.children[index]
    // A previous child may have consumed this one (e.g. an image folding its
    // trailing magic comments), so anything fully behind `pos` is done.
    if (child.to <= pos) continue
    if (child.from > pos) {
      const childMarks = inLabel(pos) ? [...base, linkTextMark] : base
      emit(out, pos, child.from, childMarks)
    }
    const baseForChild = inLabel(child.from) ? [...base, linkTextMark] : base
    const atomEnd = walkAtomChild(
      node.children,
      index,
      baseForChild,
      text,
      marks,
      out,
      options,
      context,
    )
    if (atomEnd != null) {
      pos = atomEnd
      continue
    }
    if (isReference && child.type === LEZER_NODE_IDS.LinkLabel) {
      emit(out, child.from, child.to, [...baseForChild, marks.mdMark.create()])
      pos = child.to
      continue
    }
    // An autolink inside the label is plain label text: the outer link owns
    // the href, and the muted `mdLinkUri` styling belongs to the destination.
    if (child.type === LEZER_NODE_IDS.URL && inLabel(child.from)) {
      emit(out, child.from, child.to, baseForChild)
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
      // A link label cannot contain another `[label](url)` link, but custom
      // atom syntax inside the label still uses the host resolvers.
      walk(child.children, childMarks, child.from, child.to, text, marks, out, options, context)
    }
    pos = child.to
  }
  if (pos < node.to) {
    emit(out, pos, node.to, base)
  }
}

interface FoldedMagicComments {
  magic: MagicComment
  to: number
}

/**
 * The run of magic comments chained immediately behind `nodes[index]` (an
 * image or a URL), or undefined when no magic comment directly abuts it. The
 * first comment's data wins: a rewrite of an unfolded image inserted the
 * fresh comment right at the image's end, so in a stacked run left is newest.
 */
function takeMagicComments(
  nodes: readonly InlineElement[],
  index: number,
  text: string,
): FoldedMagicComments | undefined {
  let magic: MagicComment | undefined
  let to = nodes[index].to
  for (let i = index + 1; i < nodes.length; i++) {
    const next = nodes[i]
    if (next.type !== LEZER_NODE_IDS.Comment || next.from !== to) break
    const parsed = parseMagicComment(text.slice(next.from, next.to))
    if (!parsed) break
    magic ??= parsed
    to = next.to
  }
  if (!magic) return undefined
  return { magic, to }
}

/**
 * Special walker for a direct image `![alt](url)`.
 *
 * A `trailing` run of magic comments immediately after the image (e.g.
 * `<!-- {"width":320} -->`) is folded into the mark range so it round-trips as
 * source while supplying the image's `width`.
 */
function walkImage(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
  options: InlineMarkOptions | undefined,
  context: InlineMarkContext | undefined,
  trailing?: FoldedMagicComments,
): void {
  const parts = scanLinkParts(node)
  const resolution = resolveLink(parts, text, context)
  if (resolution == null) {
    walkUnresolvedLink(node, parentMarks, text, marks, out, options, context)
    if (trailing != null) emit(out, node.to, trailing.to, parentMarks)
    return
  }

  const bracketNodes = node.children.filter((child) => child.type === LEZER_NODE_IDS.LinkMark)

  const src: string = resolution.href
  const alt: string =
    bracketNodes.length >= 2 ? text.slice(bracketNodes[0].to, bracketNodes[1].from) : ''
  const title: string = resolution.title
  const width = trailing?.magic.width ?? null
  const height = trailing?.magic.height ?? null
  const to = trailing?.to ?? node.to

  emit(out, node.from, to, [
    ...parentMarks,
    createUnitPack(marks, out, parentMarks, node.from, { key: 'image' }),
    marks.mdImage.create({
      src,
      alt,
      title,
      width,
      height,
      syntax: null,
      wikiTarget: null,
    }),
  ])
}

/**
 * Special walker for inline math `$formula$`/`$$formula$$`.
 *
 * The whole run carries `mdPack({key:'math'})` (so focus mode reveals it) and
 * `mdMath({formula})` (so `MathMarkView` renders it); the dollar runs
 * additionally carry `mdMark`, the shared syntax-character mark, so the
 * existing hide/reveal CSS applies to them.
 */
function walkMath(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
): void {
  const markNodes = node.children.filter((child) => child.type === LEZER_NODE_IDS.InlineMathMark)
  if (markNodes.length < 2) {
    emit(out, node.from, node.to, parentMarks)
    return
  }
  const formula = text.slice(markNodes[0].to, markNodes[1].from)
  const base = [
    ...parentMarks,
    createUnitPack(marks, out, parentMarks, node.from, {
      key: 'math',
      revealInFocus: true,
      revealInHide: true,
    }),
    marks.mdMath.create({ formula } satisfies MdMathAttrs),
  ]
  emit(out, node.from, markNodes[0].to, [...base, marks.mdMark.create()])
  emit(out, markNodes[0].to, markNodes[1].from, base)
  emit(out, markNodes[1].from, node.to, [...base, marks.mdMark.create()])
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

  emit(out, node.from, node.to, [
    ...parentMarks,
    createUnitPack(marks, out, parentMarks, node.from, { key: 'wikilink' }),
    marks.mdWikilink.create({ target, display }),
  ])
}

/**
 * Resolve `![[target]]` into one of Meowdown's existing source-backed atoms.
 * An absent resolver, ambiguity, or any other unresolved target deliberately
 * emits plain source text so the embed remains literal and editable.
 */
function walkWikiEmbed(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  out: MarkChunk[],
  options: WikiEmbedOptions | undefined,
): void {
  const embed = parseWikiEmbed(text.slice(node.from, node.to))
  const resolution = options?.resolveWikiEmbed?.(embed)
  if (!resolution) {
    emit(out, node.from, node.to, parentMarks)
    return
  }

  if (resolution.kind === 'image') {
    const src = resolution.src ?? embed.target
    const alt = (resolution.alt ?? embed.display) || wikiEmbedBasename(embed.target)
    emit(out, node.from, node.to, [
      ...parentMarks,
      createUnitPack(marks, out, parentMarks, node.from, { key: 'image' }),
      marks.mdImage.create({
        src,
        alt,
        title: '',
        width: embed.width,
        height: embed.height,
        syntax: 'wikiEmbed',
        wikiTarget: embed.target,
      }),
    ])
    return
  }

  if (resolution.kind === 'file') {
    const href = resolution.href ?? embed.target
    const name = (resolution.name ?? embed.display) || wikiEmbedBasename(embed.target)
    emit(out, node.from, node.to, [
      ...parentMarks,
      createUnitPack(marks, out, parentMarks, node.from, { key: 'file' }),
      marks.mdFile.create({ href, name, title: resolution.title ?? '' }),
    ])
    return
  }

  const target = resolution.target ?? embed.target
  const display = resolution.display ?? embed.display
  emit(out, node.from, node.to, [
    ...parentMarks,
    createUnitPack(marks, out, parentMarks, node.from, { key: 'wikilink' }),
    marks.mdWikilink.create({ target, display }),
  ])
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
