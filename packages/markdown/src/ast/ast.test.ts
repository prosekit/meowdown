import { describe, expect, it } from 'vitest'

import { parseMarkdownAst, serializeMarkdownAst } from '../index.ts'

import type { MarkdownDocument } from './types.ts'

describe('Markdown AST', () => {
  it('edits a task without dropping its other blocks or inline Markdown', () => {
    const ast = parseMarkdownAst(
      '+   [X] **buy** _milk_\n\n    second paragraph\n\n    > quote\n\n    ## Heading\n\n    - [ ] child\n',
    )
    const task = ast.children[0]
    expect(task).toMatchObject({
      type: 'listItem',
      kind: 'task',
      marker: '+',
      markerGap: 3,
      checked: true,
      taskMarker: 'X',
    })
    if (task.type !== 'listItem') throw new Error('Expected a list item')
    expect(task.children.map((child) => child.type)).toEqual([
      'paragraph',
      'paragraph',
      'blockquote',
      'heading',
      'listItem',
    ])
    const firstParagraph = task.children[0]
    if (firstParagraph.type !== 'paragraph') throw new Error('Expected a paragraph')
    expect(firstParagraph.value).toBe('**buy** _milk_')
    task.checked = false
    task.taskMarker = undefined
    firstParagraph.value = '**buy** _bread_'
    const output = serializeMarkdownAst(ast)
    expect(output).toContain('+   [ ] **buy** _bread_')
    expect(parseMarkdownAst(output)).toEqual(ast)
  })

  it('supports inserting and removing whole block subtrees', () => {
    const ast = parseMarkdownAst('- [ ] parent\n  - [x] child\n\nlast\n')
    const inserted = parseMarkdownAst('+ [ ] inserted\n').children[0]
    ast.children.splice(0, 1, inserted)
    expect(serializeMarkdownAst(ast)).toBe('+ [ ] inserted\n\nlast\n')
  })

  it('keeps format attributes across all persisted block kinds', () => {
    const source =
      '---\nlabel: test\n---\n\nTitle\n=====\n\n## ATX ###\n\n~~~js\ncode\n~~~\n\n$$\nx + y\n$$\n\n***\n\n<!-- hidden -->\n\n+ folded\n\n3) ordered\n\n| a | b |\n| :-- | --: |\n| c | d |\n'
    const ast = parseMarkdownAst(source, { frontmatter: true })
    expect(ast.frontmatter).toBe('label: test')
    expect(ast.children).toMatchObject([
      { type: 'heading', level: 1, setextUnderline: 5, value: 'Title' },
      { type: 'heading', level: 2, closingHashes: 3, value: 'ATX' },
      { type: 'codeBlock', language: 'js', fenceStyle: 'tilde', value: 'code' },
      { type: 'codeBlock', language: 'math', fenceStyle: 'dollar', value: 'x + y' },
      { type: 'horizontalRule', marker: '***' },
      { type: 'htmlComment', value: '<!-- hidden -->' },
      { type: 'listItem', kind: 'bullet', collapsed: true },
      { type: 'listItem', kind: 'ordered', order: 3, marker: ')' },
      {
        type: 'table',
        children: [
          {
            type: 'tableRow',
            children: [
              { header: true, align: 'left' },
              { header: true, align: 'right' },
            ],
          },
          { type: 'tableRow', children: [{ header: false }, { header: false }] },
        ],
      },
    ])
    expect(serializeMarkdownAst(ast, { frontmatter: true })).toBe(source)
  })

  it('distinguishes absent frontmatter from an empty frontmatter block', () => {
    expect(parseMarkdownAst('---\n---\n', { frontmatter: true }).frontmatter).toBe('')
    expect(parseMarkdownAst('---\n---\n').frontmatter).toBeUndefined()
    expect(
      serializeMarkdownAst(parseMarkdownAst('---\n---\n', { frontmatter: true }), {
        frontmatter: true,
      }),
    ).toBe('---\n---\n')
  })

  it('invalidates text segment metadata when raw inline Markdown changes', () => {
    const ast: MarkdownDocument = {
      type: 'document',
      children: [
        {
          type: 'blockquote',
          children: [
            {
              type: 'paragraph',
              value: '<div>\nx',
              segments: { value: '<div>\nx', chunks: ['<di', 'v>\nx'] },
            },
          ],
        },
      ],
    }
    expect(serializeMarkdownAst(ast)).toBe('> <div>\n> x\n')
    const quote = ast.children[0]
    if (quote.type !== 'blockquote') throw new Error('Expected a blockquote')
    const paragraph = quote.children[0]
    if (paragraph.type !== 'paragraph') throw new Error('Expected a paragraph')
    paragraph.value = 'changed'
    expect(serializeMarkdownAst(ast)).toBe('> changed\n')
  })
})
