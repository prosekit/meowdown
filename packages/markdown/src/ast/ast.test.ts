import { describe, expect, it } from 'vitest'

import { parseMarkdownAst, serializeMarkdownAst, walkMarkdownAst } from '../index.ts'

import type { MarkdownDocument } from './types.ts'

function withoutPositions(document: MarkdownDocument): MarkdownDocument {
  for (const { node } of walkMarkdownAst(document)) {
    if ('position' in node) delete node.position
  }
  return document
}

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
    expect(withoutPositions(parseMarkdownAst(output))).toEqual(withoutPositions(ast))
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

  it('keeps an empty list item as an item with one empty paragraph', () => {
    const ast = parseMarkdownAst('-\n')
    expect(ast.children).toEqual([
      {
        type: 'listItem',
        kind: 'bullet',
        checked: false,
        collapsed: false,
        marker: '-',
        markerGap: 1,
        children: [{ type: 'paragraph', value: '', position: { from: 1, to: 1 } }],
        position: { from: 0, to: 1 },
      },
    ])
    expect(serializeMarkdownAst(ast)).toBe('-\n')
  })

  it('round-trips empty list items between siblings', () => {
    const roundTrip = (markdown: string) => serializeMarkdownAst(parseMarkdownAst(markdown))
    expect(roundTrip('- a\n-\n- b\n')).toBe('- a\n-\n- b\n')
    expect(roundTrip('* a\n*\n* c\n')).toBe('* a\n*\n* c\n')
    expect(roundTrip('1. a\n2.\n3. b\n')).toBe('1. a\n2.\n3. b\n')
    expect(roundTrip('> -\n')).toBe('> -\n')
  })

  it('keeps the number of an ordered item only when it starts a list', () => {
    const orders = (markdown: string) => {
      return parseMarkdownAst(markdown).children.map((child) => {
        return child.type === 'listItem' ? child.order : child.type
      })
    }
    expect(orders('1. a\n2. b\n3. c\n')).toEqual([1, undefined, undefined])
    expect(orders('3. a\n3. b\n')).toEqual([3, undefined])
    expect(orders('1. a\n2. b\n4) c\n5) d\n')).toEqual([1, undefined, 4, undefined])
    expect(orders('1. a\n\n\n4. b\n')).toEqual([1, 'paragraph', 4])
  })

  it('numbers the items of an ordered list in sequence', () => {
    const roundTrip = (markdown: string) => serializeMarkdownAst(parseMarkdownAst(markdown))
    expect(roundTrip('1. a\n1. b\n1. c\n')).toBe('1. a\n2. b\n3. c\n')
    expect(roundTrip('3. a\n3. b\n')).toBe('3. a\n4. b\n')
    expect(roundTrip('1. a\n4. b\n1. c\n')).toBe('1. a\n2. b\n3. c\n')
    expect(roundTrip('1. a\n   1. x\n   1. y\n1. b\n')).toBe('1. a\n   1. x\n   2. y\n2. b\n')
    expect(roundTrip('> 1. a\n> 1. b\n')).toBe('> 1. a\n> 2. b\n')
    expect(roundTrip('1. a\n- b\n1. c\n')).toBe('1. a\n- b\n1. c\n')
    expect(roundTrip('1. a\n\n\n4. b\n')).toBe('1. a\n\n\n4. b\n')
  })

  it('numbers ordered items that carry no number', () => {
    const ast = parseMarkdownAst('5. a\n5. b\n5. c\n')
    for (const child of ast.children) {
      if (child.type === 'listItem') child.order = undefined
    }
    expect(serializeMarkdownAst(ast)).toBe('1. a\n2. b\n3. c\n')
  })
})
