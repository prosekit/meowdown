import type { MarkdownNode } from '@meowdown/markdown'
import type { ProseMirrorNode } from '@prosekit/pm/model'

import { getNodeBuilders, type TypedNodeBuilders } from '../extensions/schema.ts'

/**
 * Build nodes with the caller's schema; Markdown inline syntax remains literal text.
 */
export function astToDoc(
  node: MarkdownNode,
  nodes: TypedNodeBuilders = getNodeBuilders(),
): ProseMirrorNode {
  const children = 'children' in node ? node.children.map((child) => astToDoc(child, nodes)) : []
  switch (node.type) {
    case 'document':
      return nodes.doc(node.frontmatter == null ? {} : { frontmatter: node.frontmatter }, children)
    case 'paragraph':
      return nodes.paragraph(node.value)
    case 'heading':
      return nodes.heading(
        {
          level: node.level,
          setextUnderline: node.setextUnderline ?? null,
          closingHashes: node.closingHashes ?? null,
        },
        node.value,
      )
    case 'blockquote':
      return nodes.blockquote(children)
    case 'listItem':
      return nodes.list(
        {
          kind: node.kind,
          order: node.order ?? null,
          checked: node.checked,
          collapsed: node.collapsed,
          marker: node.marker ?? null,
          taskMarker: node.taskMarker,
          markerGap: node.markerGap,
        },
        children,
      )
    case 'codeBlock':
      return nodes.codeBlock(
        {
          language: node.language,
          fenceStyle: node.fenceStyle ?? null,
          fenceLength: node.fenceLength ?? null,
        },
        node.value,
      )
    case 'horizontalRule':
      return nodes.horizontalRule({ marker: node.marker ?? null })
    case 'htmlComment':
      return nodes.htmlComment({ content: node.value })
    case 'table':
      return nodes.table(children)
    case 'tableRow':
      return nodes.tableRow(children)
    case 'tableCell':
      return node.header
        ? nodes.tableHeaderCell({ align: node.align ?? null }, children)
        : nodes.tableCell({ align: node.align ?? null }, children)
    case 'text':
      return nodes.text(node.value)
    case 'ignored':
      throw new Error('Cannot reconstruct an unsupported editor node from Markdown')
  }
}
