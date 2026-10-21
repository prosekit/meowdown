import type { MarkdownBlock, MarkdownInline, MarkdownListItem } from './types.ts'

/**
 * Whether `next` can start on the line right under `previous` and still read
 * back as its own block. The parser records a tight gap only where this holds,
 * so the serializer can always honor it.
 */
export function canJoinTight(previous: MarkdownBlock, next: MarkdownBlock): boolean {
  if (isEmptyParagraph(previous) || isEmptyParagraph(next)) return false
  switch (next.type) {
    case 'listItem':
      // Lezer reads a bare marker of another list under an item's paragraph as
      // more of that paragraph, so only the same list carries on regardless.
      return (
        (previous.type === 'listItem' && listMarkerChar(previous) === listMarkerChar(next)) ||
        endsClosed(getLastBlock(previous)) ||
        canInterruptParagraph(next)
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
 * The innermost block that holds `block`'s last line.
 */
function getLastBlock(block: MarkdownBlock): MarkdownBlock {
  while ((block.type === 'listItem' || block.type === 'blockquote') && block.children.length > 0) {
    block = block.children[block.children.length - 1]
  }
  return block
}

function isEmptyParagraph(block: MarkdownBlock): boolean {
  return block.type === 'paragraph' && !hasInlineContent(block)
}
