import type { ProseMirrorNode } from '@prosekit/pm/model'

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
export function docToMarkdown(node: ProseMirrorNode): string {
  const out = new MdOut()
  emit(node, out)
  return out.finish()
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
    if (!this.atLineStart) this.parts.push('\n')
    this.atLineStart = true
    this.deferredBlankPrefix = this.linePrefix
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
    this.pendingFirst = savedFirst
  }

  finish(): string {
    // Trim trailing whitespace + ensure exactly one final newline.
    return this.parts.join('').replace(/\s+$/, '') + '\n'
  }

  private emitDeferredBlankLine(): void {
    const prefix = this.deferredBlankPrefix
    if (prefix === null) return
    this.parts.push(prefix, '\n')
    this.deferredBlankPrefix = null
  }
}

// ─────────────────────────────────────────────────────────────────────
// Dispatch
// ─────────────────────────────────────────────────────────────────────

function emit(node: ProseMirrorNode, out: MdOut): void {
  switch (node.type.name) {
    case 'doc':
      emitBlockChildren(node, out)
      return
    case 'paragraph':
      emitInlineChildren(node, out)
      out.closeBlock()
      return
    case 'heading': {
      const level = node.attrs.level as number
      out.write(HEADING_PREFIX[level] ?? '# ')
      emitInlineChildren(node, out)
      out.closeBlock()
      return
    }
    case 'blockquote':
      out.withPrefix('> ', '> ', () => emitBlockChildren(node, out))
      out.closeBlock()
      return
    case 'list':
      emitList(node, out)
      return
    case 'codeBlock':
      emitCodeBlock(node, out)
      return
    case 'horizontalRule':
      out.write('---')
      out.closeBlock()
      return
    case 'table':
      emitTable(node, out)
      return
    case 'text':
      if (node.text) out.write(node.text)
      return
  }
}

function emitBlockChildren(node: ProseMirrorNode, out: MdOut): void {
  const count = node.childCount
  for (let i = 0; i < count; i++) emit(node.child(i), out)
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

function emitList(node: ProseMirrorNode, out: MdOut): void {
  // prosekit's `list` node is a SINGLE item; sibling `list` nodes form the
  // larger markdown list.
  const attrs = node.attrs as {
    kind: 'bullet' | 'ordered' | 'task' | 'toggle'
    order: number | null
    checked: boolean
  }
  const marker =
    attrs.kind === 'ordered'
      ? `${attrs.order ?? 1}. `
      : attrs.kind === 'task'
        ? attrs.checked
          ? '- [x] '
          : '- [ ] '
        : '- ' // bullet | toggle

  const continuation = ' '.repeat(marker.length)
  out.withPrefix(continuation, marker, () => emitBlockChildren(node, out))
  out.closeBlock()
}

// ─────────────────────────────────────────────────────────────────────
// Code block
// ─────────────────────────────────────────────────────────────────────

function emitCodeBlock(node: ProseMirrorNode, out: MdOut): void {
  const language = (node.attrs.language as string) ?? ''
  const code = node.textContent
  const fence = '`'.repeat(longestBacktickRun(code) + 1)

  out.write(fence)
  if (language) out.write(language)
  out.write('\n')
  out.write(code)
  out.write('\n')
  out.write(fence)
  out.closeBlock()
}

/**
 * Length of the longest run of backticks in `s`, clamped to a minimum of 2
 * so the returned fence width is always >= 3 - CommonMark's minimum.
 */
function longestBacktickRun(s: string): number {
  let longest = 2
  let run = 0
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 96 /* ` */) {
      run++
      if (run > longest) longest = run
    } else {
      run = 0
    }
  }
  return longest
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
      if (cell.type.name === 'tableHeaderCell') isHeaderRow = true
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
