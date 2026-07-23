import {
  getAutolinkHref,
  type InlineElement,
  LEZER_NODE_IDS,
  parseInline,
} from '@meowdown/markdown'
import type { Mark } from '@prosekit/pm/model'

import type {
  MdFileAttrs,
  MdLinkTextAttrs,
  MdMathAttrs,
  MdPackAttrs,
  MdPackSimpleKey,
} from './inline-marks.ts'
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

/** What {@link FileLinkResolver} sees for one `[label](url)` link. */
export interface FileLinkPayload {
  /** The link destination, exactly as written in the source. */
  href: string
  /** The raw label slice between the brackets; may be empty or contain nested syntax. */
  label: string
  /** The link title, or `''` when the source has none. */
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

/** Host options that influence inline parsing. */
export interface FileLinkOptions {
  resolveFileLink?: FileLinkResolver
}

/** Host options and document context that influence inline parsing. */
export type InlineMarkOptions = FileLinkOptions &
  WikiEmbedOptions & {
    /** Document-wide definitions used to resolve reference links. */
    referenceDefinitions?: ReferenceDefinitions
    /** This textblock is itself a reference definition; disables resolution. */
    isReferenceDefinition?: boolean
    /**
     * Collector for every reference key this block looked up, resolved or
     * not, so callers can invalidate cached results when a key changes.
     */
    usedReferences?: Map<string, ReferenceDefinition | null>
  }

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
  /** Host options; omit for the default parse. */
  options?: InlineMarkOptions,
): MarkChunk[] {
  const elements = parseInline(text)
  const out: MarkChunk[] = []
  walk(elements, [], 0, text.length, text, marks, out, options)
  return out
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
  options: InlineMarkOptions | undefined,
): void {
  let pos = rangeStart
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]
    if (node.from > pos) {
      emit(out, pos, node.from, parentMarks)
    }
    const type: number = node.type
    if (type === LEZER_NODE_IDS.Link) {
      if (!hasInlineDestination(node)) {
        const definition = resolveReference(node, text, options)
        if (definition) {
          walkLink(node, parentMarks, text, marks, out, options, definition)
        } else {
          // An unresolved reference shape (`[text]`, `[text][label]`) stays
          // plain text: skip the bracket marks and walk any nested syntax.
          const children = node.children.filter(
            (child) =>
              child.type !== LEZER_NODE_IDS.LinkMark && child.type !== LEZER_NODE_IDS.LinkLabel,
          )
          walk(children, parentMarks, node.from, node.to, text, marks, out, options)
        }
      } else {
        const fileMarks = claimFileLink(node, parentMarks, text, marks, options)
        if (fileMarks) {
          emit(out, node.from, node.to, fileMarks)
        } else {
          walkLink(node, parentMarks, text, marks, out, options)
        }
      }
    } else if (type === LEZER_NODE_IDS.Image) {
      const trailing = takeMagicComment(node, nodes[index + 1], text)
      walkImage(node, parentMarks, text, marks, out, options, trailing)
      if (trailing) index++ // skip the folded comment
      pos = trailing ? trailing.to : node.to
      continue
    } else if (type === LEZER_NODE_IDS.Wikilink) {
      walkWikilink(node, parentMarks, text, marks, out)
    } else if (type === LEZER_NODE_IDS.WikiEmbed) {
      walkWikiEmbed(node, parentMarks, text, marks, out, options)
    } else if (type === LEZER_NODE_IDS.InlineMath) {
      walkMath(node, parentMarks, text, marks, out)
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
        walk(node.children, childMarks, node.from, node.to, text, marks, out, options)
      }
    }
    pos = node.to
  }
  if (pos < rangeEnd) {
    emit(out, pos, rangeEnd, parentMarks)
  }
}

interface LinkParts {
  /** End of the `[` that opens the label, or -1 when there is no label. */
  labelFrom: number
  /** Start of the `]` that closes the label, or -1 when the label never closes. */
  labelTo: number
  urlNode: InlineElement | null
  titleNode: InlineElement | null
  /** The `[label]` of a full reference, brackets included, or null. */
  referenceLabelNode: InlineElement | null
}

/**
 * Whether a `Link` node is an inline link with an explicit `(...)` destination.
 * Inline links carry at least three `LinkMark` children (`[`, `]`, `(`);
 * shortcut and reference links (`[text]`, `[text][label]`) stop at two.
 */
function hasInlineDestination(node: InlineElement): boolean {
  let linkMarkCount = 0
  for (const child of node.children) {
    if (child.type === LEZER_NODE_IDS.LinkMark) linkMarkCount++
  }
  return linkMarkCount >= 3
}

/**
 * Locate the pieces of a `Link` node in Lezer's flat child list:
 *   LinkMark `[`, [label children], LinkMark `]`, LinkMark `(`, URL,
 *   optional LinkTitle, LinkMark `)`.
 */
function scanLinkParts(node: InlineElement): LinkParts {
  let labelFrom = -1
  let labelTo = -1
  let urlNode: InlineElement | null = null
  let titleNode: InlineElement | null = null
  let referenceLabelNode: InlineElement | null = null
  let bracketCount = 0
  for (const child of node.children) {
    const childType = child.type
    if (childType === LEZER_NODE_IDS.LinkMark) {
      bracketCount++
      if (bracketCount === 1) labelFrom = child.to
      if (bracketCount === 2) labelTo = child.from
    } else if (urlNode == null && childType === LEZER_NODE_IDS.URL) {
      urlNode = child
    } else if (titleNode == null && childType === LEZER_NODE_IDS.LinkTitle) {
      titleNode = child
    } else if (referenceLabelNode == null && childType === LEZER_NODE_IDS.LinkLabel) {
      referenceLabelNode = child
    }
  }
  return { labelFrom, labelTo, urlNode, titleNode, referenceLabelNode }
}

/**
 * The normalized reference key of a `[text]` / `[text][label]` / `[text][]`
 * shape, or undefined when the label never closes or normalizes to nothing.
 */
function referenceKeyOf(node: InlineElement, text: string): string | undefined {
  const { labelFrom, labelTo, referenceLabelNode } = scanLinkParts(node)
  if (labelFrom < 0 || labelTo < 0) return undefined
  const label = text.slice(labelFrom, labelTo)
  const authored = referenceLabelNode
    ? text.slice(referenceLabelNode.from + 1, referenceLabelNode.to - 1) || label
    : label
  const key = normalizeReferenceLabel(authored)
  return key === '' ? undefined : key
}

/**
 * Resolve a reference-shaped `Link` / `Image` against the document's
 * definitions, recording the lookup (hit or miss) in `usedReferences`.
 */
function resolveReference(
  node: InlineElement,
  text: string,
  options: InlineMarkOptions | undefined,
): ReferenceDefinition | undefined {
  if (options?.referenceDefinitions === undefined || options.isReferenceDefinition === true) {
    return undefined
  }
  const key = referenceKeyOf(node, text)
  if (key === undefined) return undefined
  const definition = options.referenceDefinitions.get(key) ?? null
  options.usedReferences?.set(key, definition)
  return definition ?? undefined
}

/** The last path segment of `href` (query/hash stripped), decoded when possible. */
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
 * The marks for a whole `[label](url)` link that the host's `resolveFileLink`
 * claimed as a file, or `undefined` when the link stays a regular link. The
 * resolver is never consulted for a link without a closed label or an inline
 * destination (reference links, empty `()`).
 */
function claimFileLink(
  node: InlineElement,
  parentMarks: readonly Mark[],
  text: string,
  marks: TypedMarkBuilders,
  options: InlineMarkOptions | undefined,
): readonly Mark[] | undefined {
  const resolveFileLink = options?.resolveFileLink
  if (!resolveFileLink) return undefined
  const { labelFrom, labelTo, urlNode, titleNode } = scanLinkParts(node)
  if (labelFrom < 0 || labelTo < 0 || !urlNode) return undefined
  const href = text.slice(urlNode.from, urlNode.to)
  if (!href) return undefined
  const label = text.slice(labelFrom, labelTo)
  const title = titleNode ? unquoteTitle(text.slice(titleNode.from, titleNode.to)) : ''
  if (!resolveFileLink({ href, label, title })) return undefined
  const name = label || hrefBasename(href)
  return [...parentMarks, marks.mdFile.create({ href, name, title } satisfies MdFileAttrs)]
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
  options: InlineMarkOptions | undefined,
  reference?: ReferenceDefinition,
): void {
  const { labelTo: labelEnd, urlNode, titleNode } = scanLinkParts(node)
  const href = reference ? reference.href : urlNode ? text.slice(urlNode.from, urlNode.to) : ''
  const title = reference
    ? reference.title
    : titleNode
      ? unquoteTitle(text.slice(titleNode.from, titleNode.to))
      : ''
  const linkTextMark =
    href || reference ? marks.mdLinkText.create({ href } satisfies MdLinkTextAttrs) : null
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
    if (child.type === LEZER_NODE_IDS.WikiEmbed) {
      walkWikiEmbed(child, baseForChild, text, marks, out, options)
      pos = child.to
      continue
    }
    const maybeMarkName =
      reference && child.type === LEZER_NODE_IDS.LinkLabel
        ? 'mdMark'
        : MARK_NAME_BY_TYPE_ID.get(child.type)
    const childMarks = maybeMarkName
      ? [...baseForChild, marks[maybeMarkName].create()]
      : baseForChild
    if (child.children.length === 0) {
      emit(out, child.from, child.to, childMarks)
    } else {
      // A link label cannot contain another `[label](url)` link, but custom
      // atom syntax inside the label still uses the host resolvers.
      walk(child.children, childMarks, child.from, child.to, text, marks, out, options)
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
  options: InlineMarkOptions | undefined,
  trailing?: AdjacentMagicComment,
): void {
  const urlNode = node.children.find((child) => child.type === LEZER_NODE_IDS.URL)
  const reference = urlNode ? undefined : resolveReference(node, text, options)
  if (!urlNode && !reference) {
    // An unresolved reference image `![alt][id]` has no `URL` child; fall back
    // to the link walk, which renders nothing yet.
    walkLink(node, parentMarks, text, marks, out, undefined)
    return
  }

  const bracketNodes = node.children.filter((child) => child.type === LEZER_NODE_IDS.LinkMark)
  const titleNode = node.children.find((child) => child.type === LEZER_NODE_IDS.LinkTitle)

  const src: string = reference
    ? reference.href
    : urlNode
      ? text.slice(urlNode.from, urlNode.to)
      : ''
  const alt: string =
    bracketNodes.length >= 2 ? text.slice(bracketNodes[0].to, bracketNodes[1].from) : ''
  const title: string = reference
    ? reference.title
    : titleNode
      ? unquoteTitle(text.slice(titleNode.from, titleNode.to))
      : ''
  const width = trailing?.magic.width ?? null
  const height = trailing?.magic.height ?? null
  const to = trailing?.to ?? node.to

  emit(out, node.from, to, [
    ...parentMarks,
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
    marks.mdPack.create({ key: 'math' } satisfies MdPackAttrs),
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

  emit(out, node.from, node.to, [...parentMarks, marks.mdWikilink.create({ target, display })])
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
      marks.mdFile.create({ href, name, title: resolution.title ?? '' }),
    ])
    return
  }

  const target = resolution.target ?? embed.target
  const display = resolution.display ?? embed.display
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
