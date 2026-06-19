import dedent from 'dedent'
import { describe, expect, it } from 'vitest'

import { markdownToDoc } from './md-to-pm.ts'
import { sampleContent, sampleContentMarkdown } from './sample-content.ts'

function tableShape(markdown: string): Array<Array<{ type: string; text: string }>> {
  const table = markdownToDoc(markdown).child(0)
  const rows: Array<Array<{ type: string; text: string }>> = []
  for (let r = 0; r < table.childCount; r++) {
    const row = table.child(r)
    const cells: Array<{ type: string; text: string }> = []
    for (let c = 0; c < row.childCount; c++) {
      const cell = row.child(c)
      cells.push({ type: cell.type.name, text: cell.textContent })
    }
    rows.push(cells)
  }
  return rows
}

describe('markdownToDoc', () => {
  it('converts a heading', () => {
    expect(markdownToDoc('# Hello').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    })
  })

  it('converts a plain paragraph', () => {
    expect(markdownToDoc('hello world').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'hello world' }],
        },
      ],
    })
  })

  it('converts a blockquote', () => {
    expect(markdownToDoc('> quoted text').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'quoted text' }],
            },
          ],
        },
      ],
    })
  })

  it('flattens a bullet list', () => {
    const md = dedent`
      - one
      - two
    `
    expect(markdownToDoc(md).toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'bullet',
            order: null,
            checked: false,
            collapsed: false,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }],
        },
        {
          type: 'list',
          attrs: {
            kind: 'bullet',
            order: null,
            checked: false,
            collapsed: false,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }],
        },
      ],
    })
  })

  it('keeps the start number of an ordered list', () => {
    const md = dedent`
      5. five
      6. six
    `
    expect(markdownToDoc(md).toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'ordered',
            order: 5,
            checked: false,
            collapsed: false,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'five' }] }],
        },
        {
          type: 'list',
          attrs: {
            kind: 'ordered',
            order: 5,
            checked: false,
            collapsed: false,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'six' }] }],
        },
      ],
    })
  })

  it('converts a task list item, keeping its text', () => {
    expect(markdownToDoc('- [ ] todo').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'task',
            order: null,
            checked: false,
            collapsed: false,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'todo' }] }],
        },
      ],
    })
  })

  it('marks a checked task list item', () => {
    expect(markdownToDoc('- [x] done').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'task',
            order: null,
            checked: true,
            collapsed: false,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }],
        },
      ],
    })
  })

  it('mixes task and plain items in one bullet list', () => {
    const md = dedent`
      - [x] done
      - plain
    `
    const doc = markdownToDoc(md).toJSON() as {
      content: Array<{ attrs: { kind: string; checked: boolean } }>
    }
    expect(doc.content.map((item) => item.attrs.kind)).toEqual(['task', 'bullet'])
    expect(doc.content.map((item) => item.attrs.checked)).toEqual([true, false])
  })

  it('keeps a task marker in an ordered list as literal text', () => {
    // The flat-list schema has a single `kind`, so an ordered item cannot
    // also be a task; the marker stays in the text and round-trips verbatim.
    expect(markdownToDoc('1. [x] done').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'ordered',
            order: 1,
            checked: false,
            collapsed: false,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '[x] done' }] }],
        },
      ],
    })
  })

  it('converts a fenced code block with language', () => {
    expect(markdownToDoc('```js\nconsole.log(1)\n```').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'js' },
          content: [{ type: 'text', text: 'console.log(1)' }],
        },
      ],
    })
  })

  it('converts a horizontal rule', () => {
    expect(markdownToDoc('---').toJSON()).toEqual({
      type: 'doc',
      content: [{ type: 'horizontalRule' }],
    })
  })

  it('converts a GFM table with a header row', () => {
    const md = dedent`
      | a | b |
      |---|---|
      | 1 | 2 |
    `
    expect(markdownToDoc(md).toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeaderCell',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'a' }],
                    },
                  ],
                },
                {
                  type: 'tableHeaderCell',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'b' }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '1' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '2' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
  })

  it('keeps empty cells when the whole table is empty', () => {
    const md = dedent`
      |     |     |     |
      | --- | --- | --- |
      |     |     |     |
    `
    expect(tableShape(md)).toEqual([
      [
        { type: 'tableHeaderCell', text: '' },
        { type: 'tableHeaderCell', text: '' },
        { type: 'tableHeaderCell', text: '' },
      ],
      [
        { type: 'tableCell', text: '' },
        { type: 'tableCell', text: '' },
        { type: 'tableCell', text: '' },
      ],
    ])
  })

  it('places cells in the correct columns when some are empty', () => {
    const md = dedent`
      | a   |     | c   |
      | --- | --- | --- |
      |     | b   |     |
    `
    expect(tableShape(md)).toEqual([
      [
        { type: 'tableHeaderCell', text: 'a' },
        { type: 'tableHeaderCell', text: '' },
        { type: 'tableHeaderCell', text: 'c' },
      ],
      [
        { type: 'tableCell', text: '' },
        { type: 'tableCell', text: 'b' },
        { type: 'tableCell', text: '' },
      ],
    ])
  })

  it('pads a short row to the header column count', () => {
    const md = dedent`
      | a   | b   | c   |
      | --- | --- | --- |
      | 1   |
    `
    expect(tableShape(md)).toEqual([
      [
        { type: 'tableHeaderCell', text: 'a' },
        { type: 'tableHeaderCell', text: 'b' },
        { type: 'tableHeaderCell', text: 'c' },
      ],
      [
        { type: 'tableCell', text: '1' },
        { type: 'tableCell', text: '' },
        { type: 'tableCell', text: '' },
      ],
    ])
  })

  it('round-trips the full sample document', () => {
    expect(markdownToDoc(sampleContentMarkdown).toJSON()).toEqual(sampleContent)
  })
})

const bulletAttrs = { kind: 'bullet', order: null, checked: false, collapsed: false }

// Each `it` asserts the correct parse. Each `it.fails` asserts the IDEAL parse
// for an input the parser currently mishandles: a known DEFECT, not behavior we
// want.
describe('markdownToDoc edge cases', () => {
  it('parses an asterisk bullet as a bullet list', () => {
    expect(markdownToDoc('* star').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'list',
          attrs: bulletAttrs,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'star' }] }],
        },
      ],
    })
  })

  it('parses a paren-delimited ordered list', () => {
    expect(markdownToDoc('1) paren').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'list',
          attrs: { kind: 'ordered', order: 1, checked: false, collapsed: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'paren' }] }],
        },
      ],
    })
  })

  it('parses a zero start number on an ordered list', () => {
    expect(markdownToDoc('0. zero').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'list',
          attrs: { kind: 'ordered', order: 0, checked: false, collapsed: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'zero' }] }],
        },
      ],
    })
  })

  it('parses an uppercase task marker as checked', () => {
    expect(markdownToDoc('- [X] upper').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'list',
          attrs: { kind: 'task', order: null, checked: true, collapsed: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'upper' }] }],
        },
      ],
    })
  })

  it('parses an indented code block', () => {
    expect(markdownToDoc('    indented').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: '' },
          content: [{ type: 'text', text: 'indented' }],
        },
      ],
    })
  })

  it('parses a tilde-fenced code block', () => {
    expect(markdownToDoc('~~~\ntilde\n~~~').toJSON()).toEqual({
      type: 'doc',
      content: [
        { type: 'codeBlock', attrs: { language: '' }, content: [{ type: 'text', text: 'tilde' }] },
      ],
    })
  })

  it('treats a hash without a space as a paragraph', () => {
    expect(markdownToDoc('#nospace').toJSON()).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '#nospace' }] }],
    })
  })

  it('treats seven hashes as a paragraph', () => {
    expect(markdownToDoc('####### seven').toJSON()).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '####### seven' }] }],
    })
  })

  it('parses an empty heading', () => {
    expect(markdownToDoc('# ').toJSON()).toEqual({
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 1 } }],
    })
  })

  it('nests a blockquote inside a blockquote', () => {
    expect(markdownToDoc('> a\n>> b').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
            {
              type: 'blockquote',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }],
            },
          ],
        },
      ],
    })
  })

  it.fails('keeps the text of a setext heading', () => {
    expect(markdownToDoc('Setext1\n===').toJSON()).toEqual({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Setext1' }] },
      ],
    })
  })

  it.fails('keeps a raw HTML block as text', () => {
    expect(markdownToDoc('<div>html</div>').toJSON()).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '<div>html</div>' }] }],
    })
  })

  it.fails('keeps quote marks out of a two-line blockquote text', () => {
    expect(markdownToDoc('> l1\n> l2').toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'l1\nl2' }] }],
        },
      ],
    })
  })
})
