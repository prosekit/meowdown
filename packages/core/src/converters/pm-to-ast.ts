import type {
  MarkdownBlock,
  MarkdownDocument,
  MarkdownInline,
  MarkdownNode,
  MarkdownTableCell,
  MarkdownTableRow,
} from '@meowdown/markdown'
import type { ProseMirrorNode } from '@prosekit/pm/model'

import type { MeowdownCodeBlockAttrs } from '../extensions/code-block.ts'
import type { Frontmatter } from '../extensions/frontmatter.ts'
import type { MeowdownHeadingAttrs } from '../extensions/heading.ts'
import type { MeowdownHorizontalRuleAttrs } from '../extensions/horizontal-rule.ts'
import type { MeowdownHTMLCommentAttrs } from '../extensions/html-comment.ts'
import type { MeowdownListAttrs } from '../extensions/list.ts'
import { isNodeOfType, type NodeName } from '../extensions/node-names.ts'
import type { MeowdownTableCellAttrs } from '../extensions/table-column-align.ts'

/**
 * Read persisted block data. Editor marks do not add Markdown delimiters.
 */
export function docToAst(node: ProseMirrorNode): MarkdownNode {
  if (isNodeOfType(node, 'doc')) {
    const frontmatter = node.attrs.frontmatter as Frontmatter | undefined
    return {
      type: 'document',
      frontmatter: frontmatter ?? undefined,
      children: readBlocks(node),
    } satisfies MarkdownDocument
  }
  if (isNodeOfType(node, 'tableRow')) return readTableRow(node)
  if (isNodeOfType(node, 'tableCell') || isNodeOfType(node, 'tableHeaderCell'))
    return readTableCell(node)
  return readBlock(node)
}

function readBlocks(node: ProseMirrorNode): MarkdownBlock[] {
  const count = node.childCount
  const children: MarkdownBlock[] = new Array<MarkdownBlock>(count)
  for (let i = 0; i < count; i++) children[i] = readBlock(node.child(i))
  return children
}

function readBlock(node: ProseMirrorNode): MarkdownBlock {
  switch (node.type.name as NodeName) {
    case 'paragraph': {
      const inline = readInline(node)
      return { type: 'paragraph', value: inline.value, segments: inline.segments }
    }
    case 'heading': {
      const attrs = node.attrs as MeowdownHeadingAttrs
      const inline = readInline(node)
      return {
        type: 'heading',
        level: attrs.level,
        setextUnderline: attrs.setextUnderline ?? undefined,
        closingHashes: attrs.closingHashes ?? undefined,
        value: inline.value,
        segments: inline.segments,
      }
    }
    case 'blockquote':
      return { type: 'blockquote', children: readBlocks(node) }
    case 'list': {
      const attrs = node.attrs as MeowdownListAttrs
      return {
        type: 'listItem',
        kind: attrs.kind === 'ordered' || attrs.kind === 'task' ? attrs.kind : 'bullet',
        order: attrs.order ?? undefined,
        checked: !!attrs.checked,
        collapsed: !!attrs.collapsed,
        marker: attrs.marker ?? undefined,
        taskMarker: attrs.taskMarker ?? undefined,
        markerGap: attrs.markerGap,
        children: readBlocks(node),
      }
    }
    case 'codeBlock': {
      const attrs = node.attrs as MeowdownCodeBlockAttrs
      return {
        type: 'codeBlock',
        language: attrs.language || '',
        fenceStyle: attrs.fenceStyle ?? undefined,
        fenceLength: attrs.fenceLength ?? undefined,
        value: node.textContent,
      }
    }
    case 'horizontalRule':
      return {
        type: 'horizontalRule',
        marker: (node.attrs as MeowdownHorizontalRuleAttrs).marker ?? undefined,
      }
    case 'htmlComment':
      return { type: 'htmlComment', value: (node.attrs as MeowdownHTMLCommentAttrs).content }
    case 'table': {
      const count = node.childCount
      const children: MarkdownTableRow[] = new Array<MarkdownTableRow>(count)
      for (let i = 0; i < count; i++) children[i] = readTableRow(node.child(i))
      return { type: 'table', children }
    }
    case 'text':
      return { type: 'text', value: node.text ?? '' }
    default:
      return { type: 'ignored', value: node.textContent, hasContent: node.content.size > 0 }
  }
}

function readInline(node: ProseMirrorNode): MarkdownInline {
  if (node.childCount === 0) return { value: '' }
  const first = node.child(0)
  if (node.childCount === 1 && first.isText) return { value: first.text ?? '' }
  const chunks: Array<string | undefined> = []
  let value = ''
  node.forEach((child) => {
    const text = child.isText ? child.text : undefined
    chunks.push(text)
    if (text) value += text
  })
  return { value, segments: { value, chunks, textContent: node.textContent } }
}

function readTableRow(node: ProseMirrorNode): MarkdownTableRow {
  const count = node.childCount
  const children: MarkdownTableCell[] = new Array<MarkdownTableCell>(count)
  for (let i = 0; i < count; i++) children[i] = readTableCell(node.child(i))
  return { type: 'tableRow', children }
}

function readTableCell(node: ProseMirrorNode): MarkdownTableCell {
  return {
    type: 'tableCell',
    header: isNodeOfType(node, 'tableHeaderCell'),
    align: (node.attrs as MeowdownTableCellAttrs).align ?? undefined,
    children: readBlocks(node),
  }
}
