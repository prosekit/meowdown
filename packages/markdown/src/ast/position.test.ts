import { commonmark } from 'commonmark.json'
import { describe, expect, it } from 'vitest'

import { parseMarkdownAst, walkMarkdownAst } from '../index.ts'

import type { MarkdownBlock, MarkdownDocument, MarkdownNode, MarkdownPosition } from './types.ts'

function positionsOf(document: MarkdownDocument): Array<[string, number, number]> {
  const out: Array<[string, number, number]> = []
  for (const { node } of walkMarkdownAst(document)) {
    if (!('position' in node)) continue
    expect(node.position).toBeDefined()
    if (node.position) out.push([node.type, node.position.from, node.position.to])
  }
  return out
}

function blockPosition(block: MarkdownBlock): MarkdownPosition {
  if (!block.position) throw new Error(`Expected a position on ${block.type}`)
  return block.position
}

/**
 * Every block has a position, inside its nearest positioned ancestor, after its
 * previous sibling. Table rows and cells carry none; their cells' paragraphs sit
 * inside the table.
 */
function checkNesting(node: MarkdownNode, bounds: MarkdownPosition, label: string): void {
  let previousTo = bounds.from
  for (const child of node.children ?? []) {
    let childBounds = bounds
    if ('position' in child) {
      const position = blockPosition(child)
      expect(position.from, label).toBeGreaterThanOrEqual(previousTo)
      expect(position.to, label).toBeGreaterThanOrEqual(position.from)
      expect(position.to, label).toBeLessThanOrEqual(bounds.to)
      previousTo = position.to
      childBounds = position
    }
    checkNesting(child, childBounds, label)
  }
}

describe('Markdown AST positions', () => {
  it('covers each block with its own syntax', () => {
    const document = parseMarkdownAst(
      '# Title\n\npara\nmore\n\n```js\nx\n```\n\n---\n\n<!-- c -->\n\n| a |\n| - |\n',
    )
    expect(positionsOf(document)).toEqual([
      ['heading', 0, 7],
      ['paragraph', 9, 18],
      ['codeBlock', 20, 31],
      ['horizontalRule', 33, 36],
      ['htmlComment', 38, 48],
      ['table', 50, 61],
      ['paragraph', 52, 53],
    ])
  })

  it('positions a blank line at the end of its line', () => {
    expect(positionsOf(parseMarkdownAst('a\n\n\n\nb\n'))).toEqual([
      ['paragraph', 0, 1],
      ['paragraph', 3, 3],
      ['paragraph', 4, 4],
      ['paragraph', 5, 6],
    ])
    expect(positionsOf(parseMarkdownAst('\n\na\n\n'))).toEqual([
      ['paragraph', 0, 0],
      ['paragraph', 1, 1],
      ['paragraph', 2, 3],
      ['paragraph', 4, 4],
    ])
    expect(positionsOf(parseMarkdownAst(''))).toEqual([['paragraph', 0, 0]])
    expect(positionsOf(parseMarkdownAst('  '))).toEqual([['paragraph', 2, 2]])
  })

  it('ends a blockquote on its last quoted line', () => {
    expect(positionsOf(parseMarkdownAst('> a\n>\n> b\n>\n'))).toEqual([
      ['blockquote', 0, 11],
      ['paragraph', 2, 3],
      ['paragraph', 8, 9],
      ['paragraph', 11, 11],
    ])
    expect(positionsOf(parseMarkdownAst('>\n>\n'))).toEqual([
      ['blockquote', 0, 3],
      ['paragraph', 1, 1],
      ['paragraph', 3, 3],
    ])
  })

  it('ends a list item where its last block ends', () => {
    expect(positionsOf(parseMarkdownAst('- a\n  - b\n\n- c\n'))).toEqual([
      ['listItem', 0, 9],
      ['paragraph', 2, 3],
      ['listItem', 6, 9],
      ['paragraph', 8, 9],
      ['listItem', 11, 14],
      ['paragraph', 13, 14],
    ])
    expect(positionsOf(parseMarkdownAst('> - a\n>\n> - b\n'))).toEqual([
      ['blockquote', 0, 13],
      ['listItem', 2, 5],
      ['paragraph', 4, 5],
      ['listItem', 10, 13],
      ['paragraph', 12, 13],
    ])
  })

  it('starts a task paragraph after the checkbox', () => {
    expect(positionsOf(parseMarkdownAst('+ [x] buy\n'))).toEqual([
      ['listItem', 0, 9],
      ['paragraph', 6, 9],
    ])
    expect(positionsOf(parseMarkdownAst('- [ ] \n'))).toEqual([
      ['listItem', 0, 6],
      ['paragraph', 6, 6],
    ])
  })

  it('positions an empty item paragraph at the end of the marker line', () => {
    expect(positionsOf(parseMarkdownAst('-\n>'))).toEqual([
      ['listItem', 0, 1],
      ['paragraph', 1, 1],
      ['blockquote', 2, 3],
      ['paragraph', 3, 3],
    ])
    expect(positionsOf(parseMarkdownAst('> -\n>\n> - b\n'))).toEqual([
      ['blockquote', 0, 11],
      ['listItem', 2, 3],
      ['paragraph', 3, 3],
      ['listItem', 8, 11],
      ['paragraph', 10, 11],
    ])
  })

  it('positions an empty table cell at the pipe that closes it', () => {
    expect(positionsOf(parseMarkdownAst('| a |  | c |\n| - | - | - |\n| d |\n'))).toEqual([
      ['table', 0, 32],
      ['paragraph', 2, 3],
      ['paragraph', 7, 7],
      ['paragraph', 9, 10],
      ['paragraph', 29, 30],
      ['paragraph', 32, 32],
      ['paragraph', 32, 32],
    ])
    expect(positionsOf(parseMarkdownAst('a | | b\n--|--|--\n'))).toEqual([
      ['table', 0, 16],
      ['paragraph', 0, 1],
      ['paragraph', 4, 4],
      ['paragraph', 6, 7],
    ])
  })

  it('counts the frontmatter', () => {
    const document = parseMarkdownAst('---\nk: v\n---\n\n\n# h\n', { frontmatter: true })
    expect(positionsOf(document)).toEqual([
      ['paragraph', 14, 14],
      ['heading', 15, 18],
    ])
  })

  it('indexes the source as given when line endings are CRLF', () => {
    const document = parseMarkdownAst('# h\r\n\r\n\r\npara\r\n\r\n| a |\r\n| - |\r\n')
    expect(positionsOf(document)).toEqual([
      ['heading', 0, 3],
      ['paragraph', 7, 7],
      ['paragraph', 9, 13],
      ['table', 17, 29],
      ['paragraph', 19, 20],
    ])
    expect(document.children.map((block) => ('value' in block ? block.value : undefined))).toEqual([
      'h',
      '',
      'para',
      undefined,
    ])
    expect(positionsOf(parseMarkdownAst('a\rb'))).toEqual([['paragraph', 0, 3]])
  })

  it('nests positions in document order across the CommonMark spec', () => {
    for (const [index, example] of commonmark.entries()) {
      const label = `example ${index + 1}`
      const markdown = example.markdown
      const document = parseMarkdownAst(markdown)
      checkNesting(document, { from: 0, to: markdown.length }, label)
      const crlf = markdown.replaceAll('\n', '\r\n')
      const crlfDocument = parseMarkdownAst(crlf)
      const entries = [...walkMarkdownAst(document)]
      const crlfEntries = [...walkMarkdownAst(crlfDocument)]
      expect(crlfEntries.length, label).toBe(entries.length)
      for (let i = 0; i < entries.length; i++) {
        const node = entries[i].node
        const crlfNode = crlfEntries[i].node
        if (!('position' in node) || !('position' in crlfNode)) continue
        const position = blockPosition(node)
        const crlfPosition = blockPosition(crlfNode)
        expect(crlf.slice(crlfPosition.from, crlfPosition.to).replaceAll('\r\n', '\n'), label).toBe(
          markdown.slice(position.from, position.to),
        )
      }
    }
  })
})
