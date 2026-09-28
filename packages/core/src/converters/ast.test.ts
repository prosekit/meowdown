import { parseMarkdownAst, serializeMarkdownAst } from '@meowdown/markdown'
import { Schema } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'

import { getNodeBuilders, getNodeBuildersForSchema } from '../extensions/schema.ts'

import { astToDoc } from './ast-to-pm.ts'
import { markdownToDoc } from './md-to-pm.ts'
import { docToAst } from './pm-to-ast.ts'
import { docToMarkdown } from './pm-to-md.ts'

const shared = getNodeBuilders().doc().type.schema

describe('Markdown AST adapters', () => {
  it('uses the supplied schema for every node', () => {
    const schema = new Schema({ nodes: shared.spec.nodes, marks: shared.spec.marks })
    const nodes = getNodeBuildersForSchema(schema)
    const doc = markdownToDoc('+ [X] **raw**\n\n  > quote\n', { nodes })
    expect(doc.type.schema).toBe(schema)
    doc.descendants((node) => {
      expect(node.type.schema).toBe(schema)
    })
    expect(docToMarkdown(doc)).toBe('+ [X] **raw**\n\n  > quote\n')
  })

  it('maps parsed AST attributes to the existing schema defaults', () => {
    const source = '---\nname: test\n---\n\n- [X] **raw**\n\n| a | b |\n| :-- | --: |\n| c | d |\n'
    const ast = parseMarkdownAst(source, { frontmatter: true })
    const doc = astToDoc(ast)
    expect(docToAst(doc)).toEqual(ast)
    expect(docToMarkdown(doc, { frontmatter: true })).toBe(
      serializeMarkdownAst(ast, { frontmatter: true }),
    )
    expect(doc.child(0).attrs).toMatchObject({
      kind: 'task',
      order: null,
      checked: true,
      collapsed: false,
      marker: '-',
      taskMarker: 'X',
      markerGap: 1,
    })
  })

  it('retains text boundaries across marks without adding delimiters', () => {
    const schema = new Schema({ nodes: shared.spec.nodes, marks: { strong: {} } })
    const nodes = getNodeBuildersForSchema(schema)
    const first = schema.text('<di', [schema.mark('strong')])
    const second = schema.text('v>\n---')
    const doc = nodes.doc(nodes.blockquote(nodes.paragraph(first, second)))
    expect(docToMarkdown(doc)).toBe('> <div>\n---\n')
    const ast = docToAst(doc)
    expect(serializeMarkdownAst(ast)).toBe('> <div>\n---\n')
  })

  it('ignores inline atoms in paragraphs but retains their descendant text in tables', () => {
    const schema = new Schema({
      nodes: shared.spec.nodes.addBefore('text', 'mention', {
        inline: true,
        group: 'inline',
        content: 'text*',
        atom: true,
      }),
    })
    const nodes = getNodeBuildersForSchema(schema)
    const atom = schema.node('mention', undefined, schema.text('inside'))
    const paragraph = nodes.paragraph(atom)
    expect(docToMarkdown(nodes.doc(paragraph))).toBe('\n')
    const table = nodes.table(nodes.tableRow(nodes.tableHeaderCell(paragraph)))
    expect(docToMarkdown(nodes.doc(table))).toBe('| inside |\n| --- |\n')
  })

  it('keeps unsupported blocks as boundaries between list runs', () => {
    const schema = new Schema({
      nodes: shared.spec.nodes.addBefore('text', 'widget', { group: 'block', atom: true }),
    })
    const nodes = getNodeBuildersForSchema(schema)
    const doc = nodes.doc(
      nodes.list(nodes.paragraph('one')),
      schema.node('widget'),
      nodes.list(nodes.paragraph('two')),
    )
    expect(docToMarkdown(doc)).toBe('- one\n\n- two\n')
  })
})
