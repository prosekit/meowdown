import { CHAR_LESS_THAN } from '../unicode.ts'

import type { MarkdownBlock, MarkdownInline, MarkdownListItem } from './types.ts'

/**
 * Whether `next` can start on the line right under `previous` and still read
 * back as its own block. The parser records a tight gap only where this holds,
 * so the serializer can always honor it.
 */
export function canJoinTight(previous: MarkdownBlock, next: MarkdownBlock): boolean {
  if (isEmptyParagraph(previous) || isEmptyParagraph(next)) return false
  // A paragraph that opens an HTML block runs on to the next blank line.
  if (previous.type === 'paragraph' && opensHTMLBlock(previous.value)) return false
  switch (next.type) {
    case 'paragraph':
    case 'blockquote':
    case 'table':
      return endsClosed(previous)
    case 'heading':
      return next.setextUnderline == null ? !endsInLazyText(previous) : endsClosed(previous)
    case 'codeBlock':
      return next.fenceStyle == null || next.fenceStyle === 'tilde'
        ? !endsInLazyText(previous)
        : next.fenceStyle === 'dollar' && endsClosed(previous)
    case 'horizontalRule':
      // A dash rule under paragraph text is a setext underline.
      return (next.marker ?? '---').startsWith('-')
        ? endsClosed(previous)
        : !endsInLazyText(previous)
    case 'htmlComment':
      return !endsInLazyText(previous)
    case 'listItem':
      // Lezer reads a bare marker of another list under an item's paragraph as
      // more of that paragraph, so only the same list carries on regardless.
      return (
        (previous.type === 'listItem' && listMarkerChar(previous) === listMarkerChar(next)) ||
        endsClosed(getLastBlock(previous)) ||
        (canInterruptParagraph(next) && startsWithText(next))
      )
    default:
      return false
  }
}

/**
 * Whether `list`'s marker line still opens an item when the line above it is a
 * paragraph. CommonMark lets a list interrupt a paragraph only when the item
 * carries content and, if ordered, is numbered 1; anything else reads as more of
 * the paragraph, so the blank line before it is what keeps it a list at all.
 */
function canInterruptParagraph(list: MarkdownListItem): boolean {
  const attrs = list
  if (attrs.kind === 'ordered' && (attrs.order ?? 1) !== 1) return false
  // An empty item writes a bare marker, and a bare marker interrupts nothing.
  // A task always writes its `[ ]`, which is content enough.
  return attrs.kind === 'task' || (list.children.length > 0 && hasBlockContent(list.children[0]))
}

/**
 * The character a list item's marker ends with: the bullet itself, or the
 * delimiter after an ordered item's number. A markdown list runs for as long as
 * this stays the same, and a different one opens a new list.
 */
export function listMarkerChar(node: MarkdownBlock): string {
  if (node.type !== 'listItem') return ''
  const { kind, marker, collapsed } = node
  if (kind === 'ordered') return marker === ')' ? ')' : '.'
  if (kind === 'task') return marker === '+' ? '+' : marker === '*' ? '*' : '-'
  return collapsed ? '+' : marker === '*' ? '*' : '-'
}

export function hasInlineContent(node: MarkdownInline): boolean {
  return node.segments?.value === node.value ? node.segments.chunks.length > 0 : node.value !== ''
}

function hasBlockContent(node: MarkdownBlock): boolean {
  if (node.children) return node.children.length > 0
  if (node.type === 'ignored') return node.hasContent
  if (node.type === 'paragraph' || node.type === 'heading') return hasInlineContent(node)
  return node.type === 'codeBlock' && node.value !== ''
}

/**
 * Whether the line after `block` cannot continue it: no paragraph to extend
 * lazily, no table to add a row to.
 */
function endsClosed(block: MarkdownBlock): boolean {
  switch (block.type) {
    case 'heading':
    case 'horizontalRule':
    case 'htmlComment':
      return true
    case 'codeBlock':
      return block.fenceStyle !== 'indented'
    default:
      return false
  }
}

/**
 * Whether `block` is a container whose last line is paragraph text. The
 * serializer can write such a line lazily, and a lazy line can open a block
 * that runs on into whatever follows.
 */
function endsInLazyText(block: MarkdownBlock): boolean {
  return (
    (block.type === 'listItem' || block.type === 'blockquote') && !endsClosed(getLastBlock(block))
  )
}

/**
 * The innermost block that holds `block`'s last line.
 */
function getLastBlock(block: MarkdownBlock): MarkdownBlock {
  while ((block.type === 'listItem' || block.type === 'blockquote') && block.children.length > 0) {
    block = block.children[block.children.length - 1]
  }
  return block
}

/**
 * Whether `block`'s first line carries text that reads as neither blank nor a
 * table delimiter row, either of which the paragraph above would take in.
 */
function startsWithText(block: MarkdownBlock): boolean {
  switch (block.type) {
    case 'listItem': {
      const first = block.children[0]
      return block.kind === 'task' || (first != null && startsWithText(first))
    }
    case 'blockquote':
      return true
    case 'paragraph':
    case 'heading': {
      const lineEnd = block.value.indexOf('\n')
      const line = lineEnd < 0 ? block.value : block.value.slice(0, lineEnd)
      return !/^[\s|:-]*$/.test(line)
    }
    default:
      return false
  }
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
export function opensHTMLBlock(text: string): boolean {
  if (text.charCodeAt(0) !== CHAR_LESS_THAN) return false
  const lineEnd = text.indexOf('\n')
  const line = lineEnd < 0 ? text : text.slice(0, lineEnd)
  for (const pattern of HTML_BLOCK_OPEN) {
    if (pattern.test(line)) return true
  }
  return false
}

function isEmptyParagraph(block: MarkdownBlock): boolean {
  return block.type === 'paragraph' && !hasInlineContent(block)
}
