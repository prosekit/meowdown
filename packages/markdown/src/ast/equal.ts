import type {
  MarkdownCodeBlock,
  MarkdownHeading,
  MarkdownInline,
  MarkdownListItem,
  MarkdownNode,
} from './types.ts'

/**
 * Whether two trees hold the same nodes with the same fields, level by level.
 * An absent optional field equals one set to `undefined`. Positions are not
 * compared.
 */
export function isMarkdownAstEqual(a: MarkdownNode, b: MarkdownNode): boolean {
  const queue: Array<[MarkdownNode, MarkdownNode]> = [[a, b]]
  for (let i = 0; i < queue.length; i++) {
    const [left, right] = queue[i]
    if (!isNodeEqual(left, right)) return false
    const leftChildren = left.children
    const rightChildren = right.children
    if (leftChildren?.length !== rightChildren?.length) return false
    if (!leftChildren || !rightChildren) continue
    for (let index = 0; index < leftChildren.length; index++) {
      queue.push([leftChildren[index], rightChildren[index]])
    }
  }
  return true
}

function isInlineEqual(a: MarkdownInline, b: MarkdownInline): boolean {
  if (a.value !== b.value) return false
  const left = a.segments
  const right = b.segments
  if (!left || !right) return left === right
  return (
    left.value === right.value &&
    left.textContent === right.textContent &&
    left.chunks.length === right.chunks.length &&
    left.chunks.every((chunk, i) => chunk === right.chunks[i])
  )
}

function isHeadingEqual(a: MarkdownHeading, b: MarkdownHeading): boolean {
  return (
    a.level === b.level &&
    a.setextUnderline === b.setextUnderline &&
    a.closingHashes === b.closingHashes &&
    isInlineEqual(a, b)
  )
}

function isListItemEqual(a: MarkdownListItem, b: MarkdownListItem): boolean {
  return (
    a.kind === b.kind &&
    a.order === b.order &&
    a.checked === b.checked &&
    a.collapsed === b.collapsed &&
    a.marker === b.marker &&
    a.taskMarker === b.taskMarker &&
    a.markerGap === b.markerGap
  )
}

function isCodeBlockEqual(a: MarkdownCodeBlock, b: MarkdownCodeBlock): boolean {
  return (
    a.value === b.value &&
    a.language === b.language &&
    a.fenceStyle === b.fenceStyle &&
    a.fenceLength === b.fenceLength
  )
}

/**
 * Compare the fields of two nodes, without their children and positions.
 */
function isNodeEqual(a: MarkdownNode, b: MarkdownNode): boolean {
  switch (a.type) {
    case 'document':
      return b.type === a.type && a.frontmatter === b.frontmatter
    case 'paragraph':
      return b.type === a.type && isInlineEqual(a, b)
    case 'heading':
      return b.type === a.type && isHeadingEqual(a, b)
    case 'listItem':
      return b.type === a.type && isListItemEqual(a, b)
    case 'codeBlock':
      return b.type === a.type && isCodeBlockEqual(a, b)
    case 'horizontalRule':
      return b.type === a.type && a.marker === b.marker
    case 'tableCell':
      return b.type === a.type && a.header === b.header && a.align === b.align
    case 'ignored':
      return b.type === a.type && a.value === b.value && a.hasContent === b.hasContent
    case 'htmlComment':
    case 'text':
      return b.type === a.type && a.value === b.value
    case 'blockquote':
    case 'table':
    case 'tableRow':
      return b.type === a.type
  }
}
