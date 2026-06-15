import type { InlineElement } from '../lezer/inline.ts'
import { collectInlineElements, parseInline } from '../lezer/inline.ts'
import { LEZER_NODE_IDS } from '../lezer/node-ids.ts'
import { longestBacktickRun } from '../utils/backticks.ts'

/** A text replacement relative to the start of one textblock's text. */
export interface TextEdit {
  from: number
  to: number
  insert: string
}

/** One toggleable inline construct. */
export interface ToggleSpec {
  /** Lezer node id of the construct. */
  node: number
  /** Delimiter used when creating new spans. */
  delim: string
}

export const TOGGLE_SPECS = {
  em: { node: LEZER_NODE_IDS.Emphasis, delim: '*' },
  strong: { node: LEZER_NODE_IDS.StrongEmphasis, delim: '**' },
  code: { node: LEZER_NODE_IDS.InlineCode, delim: '`' },
  del: { node: LEZER_NODE_IDS.Strikethrough, delim: '~~' },
} as const satisfies Record<string, ToggleSpec>

export type ToggleName = keyof typeof TOGGLE_SPECS

const MARKER_IDS: ReadonlySet<number> = new Set([
  LEZER_NODE_IDS.EmphasisMark,
  LEZER_NODE_IDS.CodeMark,
  LEZER_NODE_IDS.LinkMark,
  LEZER_NODE_IDS.StrikethroughMark,
])

/** The opening and closing delimiter tokens of a toggleable node. */
function delimiters(node: InlineElement): [InlineElement, InlineElement] {
  return [node.children[0], node.children.at(-1)!]
}

/**
 * The range between a node's delimiters where new inline syntax can
 * nest, or `null` for atoms it cannot nest inside (code spans,
 * autolinks, escapes, entities, raw HTML). For links and images only
 * the label part is nestable; the URL part is part of the atom.
 */
function nestableContent(node: InlineElement): [number, number] | null {
  const { type, children } = node
  if (
    type === LEZER_NODE_IDS.Emphasis ||
    type === LEZER_NODE_IDS.StrongEmphasis ||
    type === LEZER_NODE_IDS.Strikethrough
  ) {
    return [children[0].to, children.at(-1)!.from]
  }
  if (type === LEZER_NODE_IDS.Link || type === LEZER_NODE_IDS.Image) {
    const close = children.find(
      (child, index) => index > 0 && child.type === LEZER_NODE_IDS.LinkMark,
    )
    return close ? [children[0].to, close.from] : null
  }
  return null
}

/**
 * Grow [from, to] until wrapping it cannot cut anything in half: every
 * node is either fully engulfed, untouched, or cleanly contains the
 * range inside its nestable content (then its children are checked).
 * Straddling a boundary, or touching an atom's interior, swallows the
 * node whole and restarts.
 */
function expandForWrap(
  nodes: readonly InlineElement[],
  from: number,
  to: number,
): [number, number] {
  for (const node of nodes) {
    if (node.to <= from || node.from >= to) continue
    if (from <= node.from && node.to <= to) continue
    const content = nestableContent(node)
    if (content && content[0] <= from && to <= content[1]) {
      return expandForWrap(node.children, from, to)
    }
    return expandForWrap(nodes, Math.min(from, node.from), Math.max(to, node.to))
  }
  return [from, to]
}

/**
 * Grow [from, to] to fully engulf every node it touches. Used when
 * splitting a span: the leftover parts get re-wrapped in delimiters,
 * so they must not cut through nested elements either.
 */
function engulf(nodes: readonly InlineElement[], from: number, to: number): [number, number] {
  for (const node of nodes) {
    if (node.to <= from || node.from >= to) continue
    if (from > node.from || node.to > to) {
      return engulf(nodes, Math.min(from, node.from), Math.max(to, node.to))
    }
  }
  return [from, to]
}

const isSpace = (char: string | undefined) => char === ' ' || char === '\t'

/** Shrink [from, to] so it starts and ends on non-whitespace. */
export function trimRange(text: string, from: number, to: number): [number, number] {
  while (from < to && isSpace(text[from])) from++
  while (to > from && isSpace(text[to - 1])) to--
  return [from, to]
}

/**
 * Whether every position in [from, to) already renders with `spec`.
 * Whitespace and delimiter tokens never count against it, so both
 * `**a** **b**` and `***foo***` read as fully strong when selected.
 */
export function isInlineActive(text: string, from: number, to: number, spec: ToggleSpec): boolean {
  const tree = parseInline(text)
  const covered = collectInlineElements(
    tree,
    (node) => node.type === spec.node || MARKER_IDS.has(node.type),
  )
  for (let pos = from; pos < to; pos++) {
    if (isSpace(text[pos])) continue
    if (covered.every((span) => !(span.from <= pos && pos < span.to))) return false
  }
  return true
}

/**
 * The edits that toggle `spec` over [from, to]. The range must be
 * trimmed and non-empty. `remove` is the caller's block-wide decision:
 * a multi-block toggle must apply one direction everywhere.
 */
export function toggleInlineEdits(
  text: string,
  from: number,
  to: number,
  spec: ToggleSpec,
  remove: boolean,
): TextEdit[] {
  const tree = parseInline(text)
  const spans = collectInlineElements(tree, (node) => node.type === spec.node)
  return remove ? removeEdits(text, spans, from, to) : addEdits(text, tree, spans, from, to, spec)
}

/**
 * Wrap [from, to] in new delimiters. Existing same-type spans that
 * overlap or touch the range are dissolved into the new one, because
 * delimiter runs must not collide: Lezer reads `**a****b**` as a
 * single strong with a literal `****` inside.
 */
function addEdits(
  text: string,
  tree: readonly InlineElement[],
  spans: readonly InlineElement[],
  from: number,
  to: number,
  spec: ToggleSpec,
): TextEdit[] {
  for (let width = 0; width !== to - from; ) {
    width = to - from
    ;[from, to] = expandForWrap(tree, from, to)
    for (const span of spans) {
      if (span.to === from) from = span.from
      if (span.from === to) to = span.to
    }
  }
  const edits: TextEdit[] = []
  for (const span of spans) {
    if (from <= span.from && span.to <= to) {
      const [open, close] = delimiters(span)
      edits.push({ from: open.from, to: open.to, insert: '' })
      edits.push({ from: close.from, to: close.to, insert: '' })
    }
  }
  const [open, close] = newDelimiters(text, from, to, edits, spec)
  edits.push({ from, to: from, insert: open }, { from: to, to, insert: close })
  return edits
}

/**
 * Delimiters for a new span. Code needs care: the fence must out-run
 * every backtick run left in the content, and content that starts or
 * ends with a backtick needs space padding (CommonMark strips one
 * leading and trailing space pair).
 */
function newDelimiters(
  text: string,
  from: number,
  to: number,
  deletions: readonly TextEdit[],
  spec: ToggleSpec,
): [string, string] {
  if (spec.node !== LEZER_NODE_IDS.InlineCode) return [spec.delim, spec.delim]
  let content = text.slice(from, to)
  for (const deletion of [...deletions].sort((left, right) => right.from - left.from)) {
    content = content.slice(0, deletion.from - from) + content.slice(deletion.to - from)
  }
  const fence = '`'.repeat(longestBacktickRun(content) + 1)
  const pad = content.startsWith('`') || content.endsWith('`') ? ' ' : ''
  return [fence + pad, pad + fence]
}

/**
 * Strip `spec` spans from [from, to]. Parts of a span left outside the
 * range stay formatted: its delimiters move inward, snapping past
 * whitespace (a CommonMark delimiter cannot face a space) and around
 * nested elements (a split must not cut them in half).
 */
function removeEdits(
  text: string,
  spans: readonly InlineElement[],
  from: number,
  to: number,
): TextEdit[] {
  const edits: TextEdit[] = []
  for (const span of spans) {
    if (span.to <= from || span.from >= to) continue
    const [open, close] = delimiters(span)
    let stripFrom = Math.max(from, open.to)
    let stripTo = Math.min(to, close.from)
    if (stripFrom >= stripTo) {
      // only delimiters selected: unwrap the whole span
      ;[stripFrom, stripTo] = [open.to, close.from]
    }
    ;[stripFrom, stripTo] = engulf(span.children.slice(1, -1), stripFrom, stripTo)
    while (stripFrom > open.to && isSpace(text[stripFrom - 1])) stripFrom--
    while (stripTo < close.from && isSpace(text[stripTo])) stripTo++
    if (stripFrom > open.to) {
      edits.push({ from: stripFrom, to: stripFrom, insert: text.slice(close.from, close.to) })
    } else {
      edits.push({ from: open.from, to: open.to, insert: '' })
    }
    if (stripTo < close.from) {
      edits.push({ from: stripTo, to: stripTo, insert: text.slice(open.from, open.to) })
    } else {
      edits.push({ from: close.from, to: close.to, insert: '' })
    }
  }
  return edits
}

/** What a caret (empty selection) toggle should do. */
export type CaretPlan =
  | { kind: 'unwrap'; from: number; to: number }
  | { kind: 'move'; pos: number }
  | { kind: 'insert'; pos: number }
  | null

/**
 * Caret toggles never edit existing spans; they reposition the caret
 * or plant an empty delimiter pair for upcoming typing:
 *
 * - between an empty pair: delete the pair (undoes the toggle)
 * - inside a span: hop just past it, so typing leaves the format
 * - at a span's edge: hop just inside it, so typing extends it
 * - inside an atom, or beside a delimiter character (the insert would
 *   fuse with its run): `null`, meaning refuse
 * - otherwise: insert `delim + delim` with the caret in the middle;
 *   it becomes real formatting the moment content is typed
 */
export function caretPlan(text: string, pos: number, spec: ToggleSpec): CaretPlan {
  const { delim } = spec
  const len = delim.length
  if (
    text.slice(pos - len, pos) === delim &&
    text.startsWith(delim, pos) &&
    text[pos - len - 1] !== delim[0] &&
    text[pos + len] !== delim[0]
  ) {
    return { kind: 'unwrap', from: pos - len, to: pos + len }
  }
  const tree = parseInline(text)
  const span = collectInlineElements(tree, (node) => node.type === spec.node).findLast(
    (candidate) => candidate.from <= pos && pos <= candidate.to,
  )
  if (span) {
    const [open, close] = delimiters(span)
    const target = pos === span.from ? open.to : pos === span.to ? close.from : span.to
    return { kind: 'move', pos: target }
  }
  if (insideAtom(tree, pos) || text[pos - 1] === delim[0] || text[pos] === delim[0]) {
    return null
  }
  return { kind: 'insert', pos }
}

/** Whether `pos` sits where inserted syntax could not parse: inside an atom or inside another span's delimiters. */
function insideAtom(nodes: readonly InlineElement[], pos: number): boolean {
  for (const node of nodes) {
    if (node.from < pos && pos < node.to) {
      const content = nestableContent(node)
      if (!content || pos < content[0] || pos > content[1]) return true
      return insideAtom(node.children, pos)
    }
  }
  return false
}
