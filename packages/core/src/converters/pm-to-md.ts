import type { CodeBlockAttrs } from '@prosekit/extensions/code-block'
import type { ProseMirrorNode } from '@prosekit/pm/model'

import type { Frontmatter } from '../extensions/frontmatter.ts'
import type { MeowdownHeadingAttrs } from '../extensions/heading.ts'
import type { MeowdownHorizontalRuleAttrs } from '../extensions/horizontal-rule.ts'
import type { MeowdownListAttrs } from '../extensions/list.ts'
import type { NodeName } from '../extensions/node-names.ts'
import { longestBacktickRun } from '../utils/backticks.ts'

/** Options for {@link docToMarkdown}. */
export interface DocToMarkdownOptions {
  /** Whether to serialize the doc's `frontmatter` attribute as a leading `---` block. Off by default. */
  frontmatter?: boolean
}

/**
 * Convert a ProseMirror document into a Markdown string.
 *
 * Performance design:
 * - Output accumulates in a `string[]` buffer; joined once at the end.
 *   Avoids per-block intermediate strings while keeping the
 *   function-per-node-type readability of a switch dispatch.
 * - Indent stack lives as a mutable `linePrefix` on the buffer object,
 *   restored via local variables across nested calls - no fresh
 *   context objects per recursion.
 * - Inline content is walked directly (not via `node.textContent`) to
 *   skip one intermediate string allocation per leaf block.
 * - Backtick fence width and cell escaping use single linear loops, no
 *   regex on the hot path.
 */
export function docToMarkdown(node: ProseMirrorNode, options: DocToMarkdownOptions = {}): string {
  const out = new MdOut()
  if (options.frontmatter) {
    emitFrontmatter(node.attrs.frontmatter as Frontmatter, out)
  }
  emit(node, out)
  return out.finish()
}

/**
 * Emit the document's YAML frontmatter (stored as a `doc` attribute) as a
 * leading `---\n{body}\n---` block. `null` (the default) emits nothing; an
 * empty body emits `---\n---` with no middle blank line.
 */
function emitFrontmatter(body: Frontmatter, out: MdOut): void {
  if (body === null) return
  out.write('---')
  out.write('\n')
  if (body !== '') {
    out.write(body)
    out.write('\n')
  }
  out.write('---')
  out.closeBlock()
}

/** Heading prefixes indexed by level (1..6). Index 0 is a sentinel. */
const HEADING_PREFIX: ReadonlyArray<string> = [
  '',
  '# ',
  '## ',
  '### ',
  '#### ',
  '##### ',
  '###### ',
]

function emitHeading(node: ProseMirrorNode, out: MdOut): void {
  const attrs = node.attrs as MeowdownHeadingAttrs
  const underline = attrs.setextUnderline
  // Setext exists only for levels 1-2 and needs a content line to underline;
  // an empty or deeper heading falls back to ATX.
  if (underline != null && node.content.size > 0 && attrs.level <= 2) {
    emitInlineChildren(node, out)
    const underlineChar = attrs.level === 1 ? '=' : '-'
    out.write('\n' + underlineChar.repeat(Math.max(1, underline)))
    out.closeBlock()
    return
  }
  out.write(HEADING_PREFIX[attrs.level] ?? '# ')
  emitInlineChildren(node, out)
  out.closeBlock()
}

// ─────────────────────────────────────────────────────────────────────
// Output buffer
// ─────────────────────────────────────────────────────────────────────

class MdOut {
  private parts: string[] = []
  /** Prefix applied to every new line inside the current nesting. */
  linePrefix = ''
  /** One-shot prefix for the next line only (e.g. "- " on a list item start). */
  private pendingFirst: string | null = null
  /** True iff the next emitted character starts a new line. */
  private atLineStart = true
  /**
   * If non-null, a blank line will be emitted before the next write using
   * THIS prefix (captured at `closeBlock` time). It's important to use the
   * captured prefix and not the current `linePrefix`, because by the time
   * the next write happens we may already be inside a different `withPrefix`
   * context (e.g. transitioning from a heading to a blockquote - the blank
   * line between them must use the outer "" prefix, not the blockquote's
   * "> " prefix).
   */
  private deferredBlankPrefix: string | null = null

  write(text: string): void {
    if (text === '') return
    this.emitDeferredBlankLine()
    if (this.atLineStart) {
      this.parts.push(this.pendingFirst ?? this.linePrefix)
      this.pendingFirst = null
      this.atLineStart = false
    }
    // Fast path: most writes are single-line markers or text. Only split
    // when content has embedded newlines (code block content, etc).
    if (!text.includes('\n')) {
      this.parts.push(text)
      return
    }
    const lines = text.split('\n')
    // Index loop avoids the `.entries()` iterator allocation - measurable
    // (~7%) on the hot write() path.

    for (let i = 0; i < lines.length; i++) {
      if (i > 0) this.parts.push('\n', this.linePrefix)
      if (lines[i] !== '') this.parts.push(lines[i])
    }
  }

  /** End the current block; the next write gets a blank line before it. */
  closeBlock(): void {
    // An empty block (e.g. an empty list item `- `) still owns a line: flush
    // its pending marker, trimmed, so it is neither dropped nor left dangling.
    if (this.atLineStart && this.pendingFirst !== null) {
      this.emitDeferredBlankLine()
      this.parts.push(this.pendingFirst.trimEnd())
      this.pendingFirst = null
      this.atLineStart = false
    }
    if (!this.atLineStart) this.parts.push('\n')
    this.atLineStart = true
    this.deferredBlankPrefix = this.linePrefix
  }

  /**
   * Cancel the blank line deferred by the last `closeBlock`, so the next
   * write starts directly on the following line. Used between the blocks of
   * a tight list, where markdown separates items (and an item's paragraph
   * from its nested list) with a single newline.
   */
  suppressBlank(): void {
    this.deferredBlankPrefix = null
  }

  /**
   * Run `fn` with `linePrefix` extended by `continuation`.
   * If `firstLine` is given, it replaces the prefix on the NEXT line only -
   * used for list items where the marker (`- `) only appears on line 1.
   * Composes with any outer one-shot prefix: a blockquote inside a list
   * item should emit "- > " on the first line, not just "> ".
   */
  withPrefix(continuation: string, firstLine: string | null, fn: () => void): void {
    const savedLine = this.linePrefix
    const savedFirst = this.pendingFirst
    this.linePrefix = savedLine + continuation
    if (firstLine !== null) {
      const base = savedFirst ?? savedLine
      this.pendingFirst = base + firstLine
    }
    fn()
    this.linePrefix = savedLine
    // When `firstLine` is set we folded the outer one-shot marker (`savedFirst`,
    // e.g. a blockquote's "> ") into this block's first-line marker, which `fn`
    // has by now written or flushed. Restoring `savedFirst` would re-introduce
    // that already-consumed marker, which `closeBlock` then dumps as a bare junk
    // line ("> - item\n>\n>\n"). A following sibling rebuilds its marker from
    // `savedLine` anyway, so dropping it here is safe.
    this.pendingFirst = firstLine !== null ? null : savedFirst
  }

  finish(): string {
    // Trim trailing whitespace + ensure exactly one final newline.
    return this.parts.join('').replace(/\s+$/, '') + '\n'
  }

  private emitDeferredBlankLine(): void {
    const prefix = this.deferredBlankPrefix
    if (prefix === null) return
    // Trim the prefix so blank lines carry no trailing whitespace: a list's
    // "  " continuation becomes an empty line (the following indent is what
    // keeps the item together), while a blockquote's "> " stays ">" - the
    // bare marker is required to hold the quote across the blank line.
    this.parts.push(prefix.trimEnd(), '\n')
    this.deferredBlankPrefix = null
  }
}

// ─────────────────────────────────────────────────────────────────────
// Dispatch
// ─────────────────────────────────────────────────────────────────────

function emit(node: ProseMirrorNode, out: MdOut): void {
  switch (node.type.name as NodeName) {
    case 'doc':
      emitBlockChildren(node, out)
      return
    case 'paragraph':
      emitInlineChildren(node, out)
      out.closeBlock()
      return
    case 'heading':
      emitHeading(node, out)
      return
    case 'blockquote':
      out.withPrefix('> ', '> ', () => emitBlockChildren(node, out))
      out.closeBlock()
      return
    case 'list':
      emitList(node, out, isTightItem(node))
      return
    case 'codeBlock':
      emitCodeBlock(node, out)
      return
    case 'horizontalRule': {
      const { marker } = node.attrs as MeowdownHorizontalRuleAttrs
      out.write(marker || '---')
      out.closeBlock()
      return
    }
    case 'table':
      emitTable(node, out)
      return
    case 'text':
      if (node.text) out.write(node.text)
      return
  }
}

/**
 * Emit block-level children. Consecutive `list` children form one markdown
 * list ("run") whose tightness is decided once for the whole run, matching
 * CommonMark's list-wide loose/tight semantics.
 *
 * `tightItem` is true when `node` is a list item inside a tight run: its
 * blocks (a paragraph followed by nested lists) are then separated by single
 * newlines instead of blank lines.
 */
function emitBlockChildren(node: ProseMirrorNode, out: MdOut, tightItem = false): void {
  const count = node.childCount
  let index = 0
  while (index < count) {
    const child = node.child(index)
    if (child.type.name !== ('list' satisfies NodeName)) {
      if (tightItem && index > 0) out.suppressBlank()
      emit(child, out)
      index++
      continue
    }
    let runEnd = index + 1
    while (runEnd < count && node.child(runEnd).type.name === ('list' satisfies NodeName)) runEnd++
    const tightRun = isTightRun(node, index, runEnd)
    for (let item = index; item < runEnd; item++) {
      const isRunStart = item === index
      if (isRunStart ? tightItem && index > 0 : tightRun) out.suppressBlank()
      emitList(node.child(item), out, tightRun)
    }
    index = runEnd
  }
}

/**
 * A run of sibling `list` nodes serializes tight iff every item is "simple":
 * at most one leading paragraph, then only nested lists. Any other shape
 * (multiple paragraphs, a blockquote, a code block, …) needs blank-line
 * separation inside the item, which per CommonMark makes the whole list
 * loose.
 */
function isTightRun(parent: ProseMirrorNode, from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    if (!isTightItem(parent.child(i))) return false
  }
  return true
}

function isTightItem(item: ProseMirrorNode): boolean {
  const count = item.childCount
  for (let i = 0; i < count; i++) {
    const child = item.child(i)
    if (child.type.name === ('list' satisfies NodeName)) continue
    if (child.type.name === ('paragraph' satisfies NodeName) && i === 0) continue
    return false
  }
  return true
}

/**
 * Walk inline children writing text directly. The schema has no marks, so
 * every inline child is currently a text node - but going through this
 * loop instead of `node.textContent` avoids one intermediate string
 * allocation per leaf block (paragraph / heading content).
 */
function emitInlineChildren(node: ProseMirrorNode, out: MdOut): void {
  const count = node.childCount
  for (let i = 0; i < count; i++) {
    const child = node.child(i)
    if (child.isText && child.text) out.write(child.text)
    // Future inline node types (hardBreak, image, mention) go here.
  }
}

// ─────────────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────────────

function emitList(node: ProseMirrorNode, out: MdOut, tight: boolean): void {
  const attrs = node.attrs as MeowdownListAttrs
  const bulletMarker = attrs.marker === '*' || attrs.marker === '+' ? attrs.marker : '-'
  const orderMarker = attrs.marker === ')' ? ')' : '.'
  const checkMark = attrs.taskMarker === 'X' ? 'X' : 'x'
  // The delimiter plus its original gap (1-4 spaces).
  const gap = Math.min(Math.max(attrs.markerGap ?? 1, 1), 4)
  const delimiter = attrs.kind === 'ordered' ? `${attrs.order ?? 1}${orderMarker}` : bulletMarker
  const prefix = `${delimiter}${' '.repeat(gap)}`
  const marker = attrs.kind === 'task' ? `${prefix}[${attrs.checked ? checkMark : ' '}] ` : prefix
  const continuation = ' '.repeat(prefix.length)
  out.withPrefix(continuation, marker, () => emitBlockChildren(node, out, tight))
  out.closeBlock()
}

// ─────────────────────────────────────────────────────────────────────
// Code block
// ─────────────────────────────────────────────────────────────────────

function emitCodeBlock(node: ProseMirrorNode, out: MdOut): void {
  const attrs = node.attrs as CodeBlockAttrs
  const language: string = attrs.language || ''
  const code = node.textContent
  // min 2 keeps the fence width >= 3, CommonMark's minimum.
  const fence = '`'.repeat(longestBacktickRun(code, 2) + 1)

  out.write(fence)
  if (language) out.write(language)
  out.write('\n')
  if (code) {
    out.write(code)
    out.write('\n')
  }
  out.write(fence)
  out.closeBlock()
}

// ─────────────────────────────────────────────────────────────────────
// Table
// ─────────────────────────────────────────────────────────────────────

function emitTable(node: ProseMirrorNode, out: MdOut): void {
  // Pass 1: collect rows + per-cell text, identify the header row (if any).
  const rowCount = node.childCount
  if (rowCount === 0) return
  const rows: string[][] = []
  let colCount = 0
  let headerIdx = -1
  for (let r = 0; r < rowCount; r++) {
    const row = node.child(r)
    const cells: string[] = []
    let isHeaderRow = false
    for (let c = 0; c < row.childCount; c++) {
      const cell = row.child(c)
      if (cell.type.name === ('tableHeaderCell' satisfies NodeName)) isHeaderRow = true
      cells.push(extractCellText(cell))
    }
    if (isHeaderRow && headerIdx < 0) headerIdx = r
    if (cells.length > colCount) colCount = cells.length
    rows.push(cells)
  }
  if (colCount === 0) return

  // GFM requires a header row + separator. Synthesize an empty header if
  // there isn't one in the source (rare but possible).
  const separator = '| ' + new Array(colCount).fill('---').join(' | ') + ' |'
  const headRow = headerIdx >= 0 ? rows[headerIdx] : new Array(colCount).fill('')

  out.write(formatTableRow(headRow, colCount))
  out.write('\n')
  out.write(separator)
  for (let r = 0; r < rowCount; r++) {
    if (r === headerIdx) continue
    out.write('\n')
    out.write(formatTableRow(rows[r], colCount))
  }
  out.closeBlock()
}

function formatTableRow(cells: ReadonlyArray<string>, colCount: number): string {
  let s = '|'
  for (let c = 0; c < colCount; c++) {
    s += ' ' + (cells[c] ?? '') + ' |'
  }
  return s
}

/**
 * Trim cell text and escape pipes / collapse newlines into spaces.
 *
 * Why trim: the forward parser (`markdownToDoc`) calls `.trim()`
 * on cell text, matching GFM's documented behavior. We must do the same
 * here for round-trip stability.
 *
 * Fast path: if the trimmed text contains no `|` or `\n`, return it as-is
 * with no further allocation.
 */
function extractCellText(cell: ProseMirrorNode): string {
  const raw = cell.textContent.trim()
  if (!raw.includes('|') && !raw.includes('\n')) return raw
  return raw.replaceAll('|', String.raw`\|`).replaceAll('\n', ' ')
}
