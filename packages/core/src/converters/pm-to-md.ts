import { isSpaceChar } from '@meowdown/markdown'
import type { ProseMirrorNode } from '@prosekit/pm/model'

import type { MeowdownCodeBlockAttrs } from '../extensions/code-block.ts'
import type { Frontmatter } from '../extensions/frontmatter.ts'
import type { MeowdownHeadingAttrs } from '../extensions/heading.ts'
import type { MeowdownHorizontalRuleAttrs } from '../extensions/horizontal-rule.ts'
import type { MeowdownHTMLCommentAttrs } from '../extensions/html-comment.ts'
import type { MeowdownListAttrs } from '../extensions/list.ts'
import { isNodeOfType, type NodeName } from '../extensions/node-names.ts'
import type { MeowdownTableCellAttrs, TableColumnAlign } from '../extensions/table-column-align.ts'
import {
  CHAR_ASTERISK,
  CHAR_BACKTICK,
  CHAR_DIGIT_ONE,
  CHAR_DOLLAR,
  CHAR_DOT,
  CHAR_EQUAL,
  CHAR_GREATER_THAN,
  CHAR_HASH,
  CHAR_HYPHEN_MINUS,
  CHAR_LESS_THAN,
  CHAR_LINE_FEED,
  CHAR_PLUS,
  CHAR_RIGHT_PARENTHESIS,
  CHAR_SPACE,
  CHAR_TAB,
  CHAR_TILDE,
  CHAR_UNDERSCORE,
} from '../unicode.ts'

/**
 * Options for {@link docToMarkdown}.
 */
export interface DocToMarkdownOptions {
  /**
   * Whether to serialize the doc's `frontmatter` attribute as a leading `---` block. Off by default.
   */
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
  if (options.frontmatter) emitFrontmatter(node.attrs.frontmatter as Frontmatter, out)
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
  out.write(body === '' ? '---\n---' : `---\n${body}\n---`)
  out.closeBlock()
}

/**
 * Heading prefixes indexed by level (1..6). Index 0 is a sentinel.
 */
const HEADING_PREFIX = ['', '# ', '## ', '### ', '#### ', '##### ', '###### ']

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
  // Every entry ends with the space that separates the marker from the text.
  // An empty heading has no text to separate, and writes just its hashes.
  const prefix = HEADING_PREFIX[attrs.level] ?? '# '
  out.write(node.content.size > 0 ? prefix : prefix.slice(0, -1))
  emitInlineChildren(node, out)
  const closingHashes = attrs.closingHashes
  if (closingHashes != null && closingHashes > 0) out.write(' ' + '#'.repeat(closingHashes))
  out.closeBlock()
}

// ─────────────────────────────────────────────────────────────────────
// Output buffer
// ─────────────────────────────────────────────────────────────────────

class MdOut {
  private parts: string[] = []
  /**
   * Prefix applied to every new line inside the current nesting.
   */
  linePrefix = ''
  /**
   * One-shot prefix for the next line only (e.g. "- " on a list item start).
   */
  private pendingFirst: string | null = null
  /**
   * True iff the next emitted character starts a new line.
   */
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

  /**
   * Write `text`, opening each embedded line with the current line prefix.
   *
   * `lazyLines` lets a line the prefix would change the meaning of - a setext
   * underline, a tab-indented line under a blockquote, a block opener - go out
   * as a lazy continuation instead (see `continuationPrefix`). Markdown keeps
   * such a line as text only when it arrives lazily, and the container picks
   * the paragraph up again on the next line. Only paragraph-like text may ask
   * for this: an unprefixed line would fall out of a code block, an html
   * comment, or an HTML block.
   */
  write(text: string, lazyLines = false): void {
    if (text === '') return
    this.emitDeferredBlankLine()
    if (this.atLineStart) {
      // `- ` and a paragraph reading `--` make the line `- --`, a thematic
      // break. Leave the marker on a line of its own and indent the text under
      // it, where it stays the item's own paragraph.
      if (this.pendingFirst !== null && isThematicBreak(this.pendingFirst + text)) {
        this.breakMarkerLine()
      }
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
    const prefix = this.linePrefix
    const lazy = lazyLines && prefix !== ''
    // The columns the line above went out without, which its own cells are
    // counted from and which the next line's prefix would fill with a cell.
    let lead = ''
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (i > 0) {
        const table = lazy && opensTable(line, lines[i - 1], lead)
        const written = lazy ? continuationPrefix(line, prefix, table) : prefix
        lead = prefix.slice(written.length)
        this.parts.push('\n', written)
      }
      if (line !== '') this.parts.push(line)
    }
  }

  /**
   * End a block that owns no line of its own (an empty paragraph): flush the
   * blank line owed by the previous block now and owe the next block a fresh
   * one, so each empty block yields one extra blank line. A marker-bearing
   * block (an empty list item's `- `) still owns its first line and falls
   * through to `closeBlock`. At the very start of the output there is no
   * blank line to flush or owe - leading empty blocks vanish, mirroring the
   * parser, which materializes empty paragraphs only between sibling blocks.
   */
  closeEmptyBlock(): void {
    if (!this.atLineStart || this.pendingFirst !== null) {
      this.closeBlock()
      return
    }
    if (this.parts.length === 0) return
    this.emitDeferredBlankLine()
    this.deferredBlankPrefix = this.linePrefix
  }

  /**
   * End the current block; the next write gets a blank line before it.
   */
  closeBlock(): void {
    // An empty block (e.g. an empty list item `- `) still owns a line: flush
    // its pending marker so it is neither dropped nor left dangling. The gap it
    // left for content that never came is dropped - except after a checkbox,
    // where that space is what keeps the line a task instead of a bullet whose
    // text reads `[ ]`.
    if (this.atLineStart && this.pendingFirst !== null) {
      this.emitDeferredBlankLine()
      const marker = this.pendingFirst
      this.parts.push(marker.endsWith('] ') ? marker : marker.trimEnd())
      this.pendingFirst = null
      this.atLineStart = false
    }
    if (!this.atLineStart) this.parts.push('\n')
    this.atLineStart = true
    this.deferredBlankPrefix = this.linePrefix
  }

  /**
   * Give the markers pending on this line a line of their own, so what comes
   * next opens a new one. Unlike `closeBlock` this owes no blank line: the
   * items are still part of the same tight list.
   */
  private breakMarkerLine(): void {
    if (this.pendingFirst === null) return
    this.emitDeferredBlankLine()
    this.parts.push(this.pendingFirst.trimEnd(), '\n')
    this.pendingFirst = null
    this.atLineStart = true
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

  // A task's `[ ] ` is content of its own, so what follows it opens nothing.
  get atContentStart(): boolean {
    return this.atLineStart && !this.pendingFirst?.endsWith('] ')
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
      // Three nested empty bullets fold their markers onto one line (`- - -`),
      // which reads back as a thematic break. Break the line first, so this
      // marker opens a new one under the parent item's indent.
      if (savedFirst !== null && isThematicBreak(base + firstLine)) {
        this.breakMarkerLine()
        this.pendingFirst = savedLine + firstLine
      } else {
        this.pendingFirst = base + firstLine
      }
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
    // Drop the blank lines the last block left behind and end with exactly one
    // newline. A blank line is layout; trailing spaces on a line that carries
    // content are part of that text and stay, so the text survives a round trip.
    const text = this.parts.join('')
    let cut = text.length
    for (let i = text.length - 1; i >= 0; i--) {
      const code = text.charCodeAt(i)
      if (code === CHAR_LINE_FEED) cut = i
      else if (code !== CHAR_SPACE && code !== CHAR_TAB) break
    }
    return text.slice(0, cut) + '\n'
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
      if (node.childCount === 0) {
        out.closeEmptyBlock()
        return
      }
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
    case 'htmlComment': {
      const { content } = node.attrs as MeowdownHTMLCommentAttrs
      out.write(content)
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
    if (!isNodeOfType(child, 'list')) {
      if (tightItem && index > 0) out.suppressBlank()
      emit(child, out)
      index++
      continue
    }
    let runEnd = index + 1
    while (runEnd < count && isNodeOfType(node.child(runEnd), 'list')) runEnd++
    const tightRun = isTightRun(node, index, runEnd)
    for (let item = index; item < runEnd; item++) {
      const child = node.child(item)
      const isRunStart = item === index
      const tight = isRunStart ? tightItem && index > 0 : tightRun
      // An item that carries on the list above it needs no blank line. One that
      // opens a new list does, unless its own marker can interrupt what it
      // follows - which is a paragraph whenever the blank is being dropped.
      const carriesOn =
        !isRunStart && listMarkerChar(node.child(item - 1)) === listMarkerChar(child)
      if (tight && (carriesOn || canInterruptParagraph(child))) out.suppressBlank()
      emitList(child, out, tightRun)
    }
    index = runEnd
  }
}

/**
 * Whether `list`'s marker line still opens an item when the line above it is a
 * paragraph. CommonMark lets a list interrupt a paragraph only when the item
 * carries content and, if ordered, is numbered 1; anything else reads as more of
 * the paragraph, so the blank line before it is what keeps it a list at all.
 */
function canInterruptParagraph(list: ProseMirrorNode): boolean {
  const attrs = list.attrs as MeowdownListAttrs
  if (attrs.kind === 'ordered' && (attrs.order ?? 1) !== 1) return false
  // An empty item writes a bare marker, and a bare marker interrupts nothing.
  // A task always writes its `[ ]`, which is content enough.
  return attrs.kind === 'task' || (list.childCount > 0 && list.child(0).content.size > 0)
}

/**
 * The character a list item's marker ends with: the bullet itself, or the
 * delimiter after an ordered item's number. A markdown list runs for as long as
 * this stays the same, and a different one opens a new list.
 */
function listMarkerChar(node: ProseMirrorNode): string {
  const { kind, marker, collapsed } = node.attrs as MeowdownListAttrs
  if (kind === 'ordered') return marker === ')' ? ')' : '.'
  if (kind === 'task') return marker === '+' ? '+' : marker === '*' ? '*' : '-'
  return collapsed ? '+' : marker === '*' ? '*' : '-'
}

/**
 * A run of sibling `list` nodes serializes tight iff every item is "simple":
 * at most one leading paragraph, then only nested lists. Any other shape
 * (multiple paragraphs, a blockquote, a code block, …) needs blank-line
 * separation inside the item, which per CommonMark makes the whole list
 * loose.
 */
function isTightRun(parent: ProseMirrorNode, from: number, to: number): boolean {
  for (let i = from; i < to; i++) if (!isTightItem(parent.child(i))) return false
  return true
}

function isTightItem(item: ProseMirrorNode): boolean {
  const count = item.childCount
  for (let i = 0; i < count; i++) {
    const child = item.child(i)
    const typeName = child.type.name
    if (typeName === ('list' satisfies NodeName)) continue
    if (typeName === ('paragraph' satisfies NodeName) && i === 0) continue
    return false
  }
  return true
}

// A GFM delimiter row binds to the line above it the way a setext underline
// does, turning the paragraph into a table instead of a heading. It only binds
// to a line that counts the same cells, which is why the source could keep the
// two apart by writing one of them lazily, from a column of its own.
const DELIMITER_ROW_RE = /^\s*\|?(?::?-+:?\s*\|\s*)+(?::?-+:?\s*)?$/u

function opensTable(line: string, previous: string, lead: string): boolean {
  return DELIMITER_ROW_RE.test(line) && countCells(previous) === countCells(lead + line)
}

// The cells a row carries: one per pipe, plus the cell at either end unless a
// pipe sits there too.
function countCells(row: string): number {
  const text = row.trim()
  if (text === '') return 0
  return text.split('|').length - Number(text.startsWith('|')) - Number(text.endsWith('|'))
}

/**
 * The prefix a leaf's continuation line goes out with. The container's full
 * `prefix` is the default. A line the full prefix would change the meaning of -
 * a setext underline, a tab whose columns the prefix shrinks below the four
 * that kept it inert, a block opener the source kept inert with indentation the
 * parser dedented away - needs a lazy spelling instead: without its `>` marker
 * the line can only continue the paragraph, because no block may start on a
 * lazy line.
 *
 * The lazy spelling carries `lazyIndent(prefix)`, the columns the parser
 * dedents an unmarked line by, so the text comes back exactly. It goes out bare
 * only when the dedent would leave it alone anyway and its own whitespace
 * measures four columns flush left (or it is a setext underline, which nothing
 * at the top level turns back into an underline).
 */
function continuationPrefix(line: string, prefix: string, table: boolean): string {
  // Four columns of indentation behind the prefix put a line out of reach of
  // every block opener, a setext underline included, so it is already safe.
  if (measureIndent(line, prefix.length) >= 4) return prefix
  // Whitespace that measures four columns flush left keeps the line inert on
  // its own; behind the prefix it measures less (a tab shrinks to the next tab
  // stop), so the prefix would put its content back in reach.
  const shrunk = measureIndent(line, 0) >= 4
  const underline = table || isSetextUnderline(line)
  const opens = !shrunk && lineOpensBlock(line)
  if (!shrunk && !underline && !opens) return prefix
  const lazy = lazyIndent(prefix)
  // Bare keeps the line byte-exact, but only when the parser's dedent leaves
  // it alone and nothing at the far left reads it back as a block: an
  // underline binds to no lazy paragraph, while an opener still opens.
  return !opens && dedentKeepsLine(line, lazy.length) ? '' : lazy
}

/**
 * The lazy spelling's indent: the whitespace the containers write after the
 * last `>` marker, which is also the columns the parser dedents an unmarked
 * continuation line by (`sliceColumn` in `md-to-pm.ts`). The single space
 * directly after the `>` belongs to the marker, not to the indent. A prefix
 * with no `>` to drop has flush left as its only lazy spelling: its columns
 * are the list's own indent, and writing them would just re-match the item.
 */
function lazyIndent(prefix: string): string {
  let start = prefix.length
  while (start > 0 && prefix.charCodeAt(start - 1) === CHAR_SPACE) start--
  if (start === 0 || prefix.charCodeAt(start - 1) !== CHAR_GREATER_THAN) return ''
  return prefix.slice(start + 1)
}

/**
 * Whether the parser's dedent (`sliceColumn` at `column`) returns `line`
 * unchanged: its leading whitespace stops short of the column, or a tab in it
 * reaches past. Such a line round-trips byte-exact when written bare.
 */
function dedentKeepsLine(line: string, column: number): boolean {
  let col = 0
  for (let index = 0; col < column; index++) {
    const code = line.charCodeAt(index)
    if (code === CHAR_SPACE) {
      col += 1
    } else if (code === CHAR_TAB) {
      const width = 4 - (col % 4)
      if (col + width > column) return true
      col += width
    } else {
      return true
    }
  }
  return false
}

/**
 * The line patterns that open an HTML block, the openers of `HTMLBlockStyle`
 * in `@lezer/markdown`: script/pre/style, a comment, a processing instruction,
 * a declaration, CDATA, a known block-level tag, and a complete tag alone on
 * its line. Leading whitespace is stripped before matching.
 */
const HTML_BLOCK_OPEN = [
  /^<(?:script|pre|style)(?:\s|>|$)/i,
  /^<!--/,
  /^<\?/,
  /^<![A-Z]/,
  /^<!\[CDATA\[/,
  /^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i,
  /^(?:<\/[a-z][\w-]*\s*>|<[a-z][\w-]*(\s+[a-z:_][\w.-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*>)\s*$/i,
]

/**
 * Whether `text`'s first line opens an HTML block. The last pattern (a
 * complete tag) cannot interrupt a paragraph, but a lazy spelling of such a
 * line round-trips all the same, so one check serves both callers.
 */
function opensHTMLBlock(text: string): boolean {
  if (text.charCodeAt(0) !== CHAR_LESS_THAN) return false
  const lineEnd = text.indexOf('\n')
  const line = lineEnd < 0 ? text : text.slice(0, lineEnd)
  return HTML_BLOCK_OPEN.some((pattern) => pattern.test(line))
}

/**
 * Whether `line`, at the start of a container's content, opens a block instead
 * of continuing the paragraph above it: a blockquote, an ATX heading, a fence,
 * `$$` math, an HTML block, a thematic break, a bullet item (even an empty
 * one), and an ordered item that carries content and is numbered 1.
 */
function lineOpensBlock(line: string): boolean {
  // The whitespace in front measures under four columns here, so it does not
  // put the opener out of reach.
  let index = 0
  while (isSpaceOrTab(line.charCodeAt(index))) index++
  const first = line.charCodeAt(index)
  switch (first) {
    case CHAR_GREATER_THAN:
      return true
    case CHAR_LESS_THAN:
      return opensHTMLBlock(index === 0 ? line : line.slice(index))
    case CHAR_HASH: {
      let end = index + 1
      while (line.charCodeAt(end) === CHAR_HASH) end++
      return end - index <= 6 && (end === line.length || isSpaceOrTab(line.charCodeAt(end)))
    }
    case CHAR_BACKTICK:
    case CHAR_TILDE: {
      let end = index + 1
      while (line.charCodeAt(end) === first) end++
      return end - index >= 3
    }
    case CHAR_DOLLAR:
      return line.charCodeAt(index + 1) === CHAR_DOLLAR
    case CHAR_UNDERSCORE:
      return isUnderscoreBreak(line, index)
    case CHAR_ASTERISK:
    case CHAR_HYPHEN_MINUS:
    case CHAR_PLUS:
      // A bullet marker opens an item even with nothing after it; an ordered
      // marker below does not.
      return (
        isThematicBreak(line) ||
        index + 1 >= line.length ||
        isSpaceOrTab(line.charCodeAt(index + 1))
      )
    case CHAR_DIGIT_ONE: {
      const delimiter = line.charCodeAt(index + 1)
      return (
        (delimiter === CHAR_DOT || delimiter === CHAR_RIGHT_PARENTHESIS) &&
        startsNonEmptyItem(line, index + 1)
      )
    }
    default:
      return false
  }
}

/**
 * A `___` thematic break: three or more underscores with nothing but spaces
 * and tabs between them. (`isThematicBreak` covers `-` and `*`, the two break
 * characters that double as list bullets.)
 */
function isUnderscoreBreak(line: string, index: number): boolean {
  let count = 0
  for (; index < line.length; index++) {
    const code = line.charCodeAt(index)
    if (code === CHAR_UNDERSCORE) count++
    else if (!isSpaceOrTab(code)) return false
  }
  return count >= 3
}

/**
 * Whether the list delimiter at `index` is followed by the gap and content
 * (`1. x`) that let an ordered item interrupt a paragraph.
 */
function startsNonEmptyItem(line: string, index: number): boolean {
  if (!isSpaceOrTab(line.charCodeAt(index + 1))) return false
  for (let i = index + 2; i < line.length; i++) if (!isSpaceOrTab(line.charCodeAt(i))) return true
  return false
}

/**
 * The columns of leading whitespace `line` stands for when it starts at column
 * `start`, where a tab reaches the next multiple of four.
 */
function measureIndent(line: string, start: number): number {
  let col = start
  for (let i = 0; i < line.length; i++) {
    const code = line.charCodeAt(i)
    if (code === CHAR_SPACE) col += 1
    else if (code === CHAR_TAB) col += 4 - (col % 4)
    else break
  }
  return col - start
}

/**
 * Whether `line` is a run of one character, `=` or `-`, and so would read as a
 * setext underline under a container's line prefix. Surrounding whitespace does
 * not save it: an underline may carry any indentation the prefix leaves under
 * four columns, and any trailing spaces at all.
 */
function isSetextUnderline(line: string): boolean {
  // Measured against `/^\s*([=-])\1*\s*$/u` over the lines this actually sees
  // (mostly prose, some underlines, two 400-char lines), chromium, `pnpm bench`:
  // this scan 1.77M hz, the regex 1.08M hz - 1.65x, repeatable across runs.
  let start = 0
  while (start < line.length && isSpaceChar(line.charCodeAt(start))) start++
  const first = line.charCodeAt(start)
  if (first !== CHAR_EQUAL && first !== CHAR_HYPHEN_MINUS) return false
  let end = line.length
  while (isSpaceChar(line.charCodeAt(end - 1))) end--
  for (let i = start + 1; i < end; i++) if (line.charCodeAt(i) !== first) return false
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
  if (count === 0) return
  // A leaf whose first line opens an HTML block (`<?`, `<!--`, `<div`) reads
  // back as one, and an HTML block keeps a continuation line only when it
  // carries its container markers - there is no lazy continuation to fall back
  // on, so every line keeps the full prefix.
  const first = node.child(0).text
  const lazy = first == null || !out.atContentStart || !opensHTMLBlock(first)
  for (let i = 0; i < count; i++) {
    const child = node.child(i)
    if (child.isText && child.text) out.write(child.text, lazy)
    // Future inline node types (hardBreak, image, mention) go here.
  }
}

// ─────────────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────────────

function emitList(node: ProseMirrorNode, out: MdOut, tight: boolean): void {
  const { kind, order, taskMarker, markerGap, checked } = node.attrs as MeowdownListAttrs
  // A bullet records its fold state in the marker: `+` is collapsed, `-`/`*` are
  // expanded. A task uses `+` for the circle shape, independent of collapse (a
  // task's fold is view-state and never written to Markdown).
  const markerChar = listMarkerChar(node)
  const checkMark = taskMarker === 'X' ? 'X' : 'x'
  // The delimiter plus its original gap (1-4 spaces).
  const gap = Math.min(Math.max(markerGap ?? 1, 1), 4)
  const delimiter = kind === 'ordered' ? `${order ?? 1}${markerChar}` : markerChar
  const prefix = `${delimiter}${' '.repeat(gap)}`
  const outputMarker = kind === 'task' ? `${prefix}[${checked ? checkMark : ' '}] ` : prefix
  const continuation = ' '.repeat(prefix.length)
  out.withPrefix(continuation, outputMarker, () => emitBlockChildren(node, out, tight))
  out.closeBlock()
}

/**
 * Whether a line of list markers reads as a thematic break: three or more `-`
 * or `*`, all the same character, with nothing but spaces, tabs and blockquote
 * markers around them.
 */
function isThematicBreak(line: string): boolean {
  let breakChar = 0
  let count = 0
  for (let i = 0; i < line.length; i++) {
    const code = line.charCodeAt(i)
    if (code === CHAR_LINE_FEED) break
    if (code === CHAR_SPACE || code === CHAR_TAB) continue
    // A blockquote marker only opens the line. One between the dashes is text,
    // and text keeps the line from reading as a break at all.
    if (code === CHAR_GREATER_THAN && count === 0) continue
    if (code !== CHAR_HYPHEN_MINUS && code !== CHAR_ASTERISK) return false
    if (breakChar === 0) breakChar = code
    else if (code !== breakChar) return false
    count++
  }
  return count >= 3
}

// ─────────────────────────────────────────────────────────────────────
// Code block
// ─────────────────────────────────────────────────────────────────────

function emitCodeBlock(node: ProseMirrorNode, out: MdOut): void {
  const attrs = node.attrs as MeowdownCodeBlockAttrs
  const language: string = attrs.language || ''
  const code = node.textContent

  if (attrs.fenceStyle === 'indented' && !language) {
    const indentedCode = toIndentedCode(code)
    if (indentedCode != null) {
      out.write(indentedCode)
      out.closeBlock()
      return
    }
  }

  // A `$$` fence cannot widen, so a content line reading `$$` (which would
  // close it early) and a language other than `math` (e.g. re-picked in the
  // language selector) both fall back to a backtick ```math fence.
  if (attrs.fenceStyle === 'dollar' && language === 'math' && !hasDollarFenceLine(code)) {
    out.write('$$')
    out.write('\n')
    if (code) {
      out.write(code)
      out.write('\n')
    }
    out.write('$$')
    out.closeBlock()
    return
  }

  const tilde = attrs.fenceStyle === 'tilde'
  // A recorded opening-fence length only ever widens the fence.
  const fence = (tilde ? '~' : '`').repeat(
    Math.max(attrs.fenceLength ?? 0, minFenceLength(code, tilde)),
  )

  out.write(fence)
  // An info string that opens with the fence character would widen the fence
  // instead of naming a language; a space keeps the two apart.
  if (language) out.write(language.startsWith(tilde ? '~' : '`') ? ' ' + language : language)
  out.write('\n')
  if (code) {
    out.write(code)
    out.write('\n')
  }
  out.write(fence)
  out.closeBlock()
}

/**
 * The narrowest fence that can hold `code`: wider than every line of it that
 * would close the fence early, and never under CommonMark's minimum of three. A
 * closing fence is a run of the fence character alone on its line; a run with
 * anything else on the line (`` a ``` ``, `` ``` x ``) or four columns in closes
 * nothing, so the fence holds it as it is.
 */
export function minFenceLength(code: string, tilde: boolean): number {
  const fenceChar = tilde ? CHAR_TILDE : CHAR_BACKTICK
  let longest = 2
  let lineStart = 0
  while (lineStart <= code.length) {
    let lineEnd = code.indexOf('\n', lineStart)
    if (lineEnd < 0) lineEnd = code.length
    // Up to three columns of indentation, and a tab is four of them.
    let index = lineStart
    while (index < lineEnd && code.charCodeAt(index) === CHAR_SPACE) index++
    if (index - lineStart < 4) {
      const runStart = index
      while (index < lineEnd && code.charCodeAt(index) === fenceChar) index++
      const run = index - runStart
      while (index < lineEnd && isSpaceOrTab(code.charCodeAt(index))) index++
      if (index === lineEnd && run > longest) longest = run
    }
    lineStart = lineEnd + 1
  }
  return longest + 1
}

function isSpaceOrTab(char: number): boolean {
  return char === CHAR_SPACE || char === CHAR_TAB
}

/**
 * Whether indentation can spell `code` as an indented code block. There is no
 * line to carry the four columns of a block with no content at all, and none to
 * carry a blank line at either end.
 */
export function canIndentCode(code: string): boolean {
  return code !== '' && !code.startsWith('\n') && !code.endsWith('\n')
}

/**
 * Indent `code` for an indented code block, or return `undefined` for shapes
 * the indented form cannot express, which fall back to a fence. Blank interior
 * lines stay empty so a round-trip adds no trailing whitespace; `MdOut.write`
 * still prepends the enclosing `linePrefix` (blockquote or list continuation)
 * per line.
 */
function toIndentedCode(code: string): string | undefined {
  if (!canIndentCode(code)) return undefined
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) if (lines[i] !== '') lines[i] = `    ${lines[i]}`
  return lines.join('\n')
}

/**
 * Whether any content line would read as a closing `$$` fence.
 */
function hasDollarFenceLine(code: string): boolean {
  return code.split('\n').some((line) => line.trim() === '$$')
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
      if (isNodeOfType(cell, 'tableHeaderCell')) isHeaderRow = true
      cells.push(extractCellText(cell))
    }
    if (isHeaderRow && headerIdx < 0) headerIdx = r
    if (cells.length > colCount) colCount = cells.length
    rows.push(cells)
  }
  if (colCount === 0) return

  // GFM requires a header row + separator. Synthesize an empty header if
  // there isn't one in the source (rare but possible). The alignment row
  // (header row, or the first row of a headerless table) drives the
  // delimiter row's `:` markers.
  const alignmentRow = node.child(headerIdx >= 0 ? headerIdx : 0)
  const delimiters: string[] = []
  for (let c = 0; c < colCount; c++) {
    const cell = c < alignmentRow.childCount ? alignmentRow.child(c) : undefined
    const align = cell ? (cell.attrs as MeowdownTableCellAttrs).align : undefined
    delimiters.push(formatDelimiter(align))
  }
  const separator = '| ' + delimiters.join(' | ') + ' |'
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

function formatDelimiter(align: TableColumnAlign | null | undefined): string {
  switch (align) {
    case 'left':
      return ':--'
    case 'center':
      return ':-:'
    case 'right':
      return '--:'
    default:
      return '---'
  }
}

function formatTableRow(cells: ReadonlyArray<string>, colCount: number): string {
  let s = '|'
  for (let c = 0; c < colCount; c++) s += ' ' + (cells[c] ?? '') + ' |'
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
