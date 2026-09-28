import type { MarkdownNode } from '@meowdown/markdown'
import { getNodeType } from '@prosekit/core'
import type { Attrs, NodeType, ProseMirrorNode, Schema } from '@prosekit/pm/model'

import type { NodeName } from '../extensions/node-names.ts'
import { getSharedSchema } from '../extensions/schema.ts'

/**
 * Build nodes with the caller's schema; Markdown inline syntax remains literal text.
 *
 * Nodes are created with `NodeType.create` rather than the typed builders: the
 * AST already has the shape the schema wants, so the builders' argument
 * normalization and `createAndFill` content matching are pure overhead here.
 * Only a container with no children is filled, so an empty list item or cell
 * still gets the paragraph the schema requires.
 */
export function astToDoc(node: MarkdownNode, schema: Schema = getSharedSchema()): ProseMirrorNode {
  switch (node.type) {
    case 'document':
      return createContainer(
        nodeTypeOf(schema, 'doc'),
        node.frontmatter == null ? null : { frontmatter: node.frontmatter },
        node.children,
        schema,
      )
    case 'paragraph':
      return createTextblock(nodeTypeOf(schema, 'paragraph'), null, node.value, schema)
    case 'heading':
      return createTextblock(
        nodeTypeOf(schema, 'heading'),
        {
          level: node.level,
          setextUnderline: node.setextUnderline ?? null,
          closingHashes: node.closingHashes ?? null,
        },
        node.value,
        schema,
      )
    case 'blockquote':
      return createContainer(nodeTypeOf(schema, 'blockquote'), null, node.children, schema)
    case 'listItem':
      return createContainer(
        nodeTypeOf(schema, 'list'),
        {
          kind: node.kind,
          order: node.order ?? null,
          checked: node.checked,
          collapsed: node.collapsed,
          marker: node.marker ?? null,
          taskMarker: node.taskMarker,
          markerGap: node.markerGap,
        },
        node.children,
        schema,
      )
    case 'codeBlock':
      return createTextblock(
        nodeTypeOf(schema, 'codeBlock'),
        {
          language: node.language,
          fenceStyle: node.fenceStyle ?? null,
          fenceLength: node.fenceLength ?? null,
        },
        node.value,
        schema,
      )
    case 'horizontalRule':
      return nodeTypeOf(schema, 'horizontalRule').create({ marker: node.marker ?? null })
    case 'htmlComment':
      return nodeTypeOf(schema, 'htmlComment').create({ content: node.value })
    case 'table':
      return createContainer(nodeTypeOf(schema, 'table'), null, node.children, schema)
    case 'tableRow':
      return createContainer(nodeTypeOf(schema, 'tableRow'), null, node.children, schema)
    case 'tableCell':
      return createContainer(
        nodeTypeOf(schema, node.header ? 'tableHeaderCell' : 'tableCell'),
        { align: node.align ?? null },
        node.children,
        schema,
      )
    case 'text':
      return schema.text(node.value)
    case 'ignored':
      throw new Error('Cannot reconstruct an unsupported editor node from Markdown')
  }
}

function nodeTypeOf(schema: Schema, name: NodeName): NodeType {
  return getNodeType(schema, name)
}

function createTextblock(
  type: NodeType,
  attrs: Attrs | null,
  value: string,
  schema: Schema,
): ProseMirrorNode {
  return type.create(attrs, value === '' ? null : schema.text(value))
}

function createContainer(
  type: NodeType,
  attrs: Attrs | null,
  children: MarkdownNode[],
  schema: Schema,
): ProseMirrorNode {
  if (children.length === 0) {
    const filled = type.createAndFill(attrs)
    if (filled == null) throw new Error(`Cannot fill an empty ${type.name} node`)
    return filled
  }
  const count = children.length
  const content: ProseMirrorNode[] = new Array<ProseMirrorNode>(count)
  for (let i = 0; i < count; i++) content[i] = astToDoc(children[i], schema)
  return type.create(attrs, content)
}
