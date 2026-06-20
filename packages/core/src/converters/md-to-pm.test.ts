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
  it('keeps a heading', () => {
    expect(markdownToDoc('# Hello').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'heading',
          attrs: { level: 1, setextUnderline: null },
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    })
  })

  it('keeps a paragraph', () => {
    expect(markdownToDoc('hello world').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'hello world' }],
        },
      ],
    })
  })

  it('keeps a blockquote', () => {
    expect(markdownToDoc('> quoted text').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
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

  it('keeps a bullet list', () => {
    const md = dedent`
      - one
      - two
    `
    expect(markdownToDoc(md).toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'bullet',
            order: null,
            checked: false,
            collapsed: false,
            marker: '-',
            taskMarker: null,
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
            marker: '-',
            taskMarker: null,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }],
        },
      ],
    })
  })

  it('keeps each ordered item number', () => {
    const md = dedent`
      5. five
      6. six
    `
    expect(markdownToDoc(md).toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'ordered',
            order: 5,
            checked: false,
            collapsed: false,
            marker: '.',
            taskMarker: null,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'five' }] }],
        },
        {
          type: 'list',
          attrs: {
            kind: 'ordered',
            order: 6,
            checked: false,
            collapsed: false,
            marker: '.',
            taskMarker: null,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'six' }] }],
        },
      ],
    })
  })

  it('keeps a task item', () => {
    expect(markdownToDoc('- [ ] todo').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'task',
            order: null,
            checked: false,
            collapsed: false,
            marker: '-',
            taskMarker: null,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'todo' }] }],
        },
      ],
    })
  })

  it('keeps a checked task', () => {
    expect(markdownToDoc('- [x] done').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'task',
            order: null,
            checked: true,
            collapsed: false,
            marker: '-',
            taskMarker: 'x',
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }],
        },
      ],
    })
  })

  it('keeps mixed task and plain items', () => {
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

  it('keeps a literal task marker in an ordered item', () => {
    // The flat-list schema has a single `kind`, so an ordered item cannot
    // also be a task; the marker stays in the text and round-trips verbatim.
    expect(markdownToDoc('1. [x] done').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'ordered',
            order: 1,
            checked: false,
            collapsed: false,
            marker: '.',
            taskMarker: null,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '[x] done' }] }],
        },
      ],
    })
  })

  it('keeps a fenced block with language', () => {
    expect(markdownToDoc('```js\nconsole.log(1)\n```').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'js' },
          content: [{ type: 'text', text: 'console.log(1)' }],
        },
      ],
    })
  })

  it('keeps a horizontal rule', () => {
    expect(markdownToDoc('---').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [{ type: 'horizontalRule', attrs: { marker: null } }],
    })
  })

  it('keeps a table with a header', () => {
    const md = dedent`
      | a | b |
      |---|---|
      | 1 | 2 |
    `
    expect(markdownToDoc(md).toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
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

  it('keeps empty table cells', () => {
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

  it('keeps cells in their columns', () => {
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

  it('unescapes an escaped pipe in a cell', () => {
    const md = dedent`
      | a \| b | c   |
      | ------- | --- |
      | 1       | 2   |
    `
    expect(tableShape(md)).toEqual([
      [
        { type: 'tableHeaderCell', text: 'a | b' },
        { type: 'tableHeaderCell', text: 'c' },
      ],
      [
        { type: 'tableCell', text: '1' },
        { type: 'tableCell', text: '2' },
      ],
    ])
  })

  it('keeps a short row padded', () => {
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

  it('keeps the sample document', () => {
    expect(markdownToDoc(sampleContentMarkdown).toJSON()).toEqual(sampleContent)
  })

  it('keeps an asterisk bullet', () => {
    expect(markdownToDoc('* star').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'bullet',
            order: null,
            checked: false,
            collapsed: false,
            marker: '*',
            taskMarker: null,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'star' }] }],
        },
      ],
    })
  })

  it('keeps a paren ordered delimiter', () => {
    expect(markdownToDoc('1) paren').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'ordered',
            order: 1,
            checked: false,
            collapsed: false,
            marker: ')',
            taskMarker: null,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'paren' }] }],
        },
      ],
    })
  })

  it('keeps a zero start', () => {
    expect(markdownToDoc('0. zero').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'ordered',
            order: 0,
            checked: false,
            collapsed: false,
            marker: '.',
            taskMarker: null,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'zero' }] }],
        },
      ],
    })
  })

  it('keeps an uppercase task marker', () => {
    expect(markdownToDoc('- [X] upper').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'list',
          attrs: {
            kind: 'task',
            order: null,
            checked: true,
            collapsed: false,
            marker: '-',
            taskMarker: 'X',
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'upper' }] }],
        },
      ],
    })
  })

  it('keeps an indented code block', () => {
    expect(markdownToDoc('    indented').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'codeBlock',
          attrs: { language: '' },
          content: [{ type: 'text', text: 'indented' }],
        },
      ],
    })
  })

  it('keeps a tilde fence', () => {
    expect(markdownToDoc('~~~\ntilde\n~~~').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        { type: 'codeBlock', attrs: { language: '' }, content: [{ type: 'text', text: 'tilde' }] },
      ],
    })
  })

  it('keeps a spaceless hash as text', () => {
    expect(markdownToDoc('#nospace').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '#nospace' }] }],
    })
  })

  it('keeps seven hashes as text', () => {
    expect(markdownToDoc('####### seven').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '####### seven' }] }],
    })
  })

  it('keeps an empty heading', () => {
    expect(markdownToDoc('# ').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [{ type: 'heading', attrs: { level: 1, setextUnderline: null } }],
    })
  })

  it('keeps a nested quote', () => {
    expect(markdownToDoc('> a\n>> b').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
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

  it('keeps setext text', () => {
    expect(markdownToDoc('Setext1\n===').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'heading',
          attrs: { level: 1, setextUnderline: 3 },
          content: [{ type: 'text', text: 'Setext1' }],
        },
      ],
    })
  })

  it('keeps setext text (level 2)', () => {
    expect(markdownToDoc('Setext2\n---').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'heading',
          attrs: { level: 2, setextUnderline: 3 },
          content: [{ type: 'text', text: 'Setext2' }],
        },
      ],
    })
  })

  it('keeps a raw HTML block', () => {
    expect(markdownToDoc('<div>html</div>').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '<div>html</div>' }] }],
    })
  })

  it('keeps a processing instruction', () => {
    expect(markdownToDoc('<?php echo 1; ?>').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '<?php echo 1; ?>' }] }],
    })
  })

  it('keeps a two-line quote clean', () => {
    expect(markdownToDoc('> l1\n> l2').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'l1\nl2' }] }],
        },
      ],
    })
  })

  it('keeps YAML frontmatter as a doc attribute', () => {
    // The whole input is the frontmatter block, so the only content is the
    // empty paragraph the schema fills in (it serializes back to nothing).
    expect(markdownToDoc('---\ntitle: x\n---').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: 'title: x' },
      content: [{ type: 'paragraph' }],
    })
  })

  it('keeps a multi-line frontmatter body literal before content', () => {
    const md = '---\ntitle: x\ntags: [a, b]\n---\n\n# heading'
    expect(markdownToDoc(md).toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: 'title: x\ntags: [a, b]' },
      content: [
        {
          type: 'heading',
          attrs: { level: 1, setextUnderline: null },
          content: [{ type: 'text', text: 'heading' }],
        },
      ],
    })
  })

  it('keeps an empty frontmatter block as an empty string', () => {
    expect(markdownToDoc('---\n---').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: '' },
      content: [{ type: 'paragraph' }],
    })
  })

  it('keeps a lone dashes line as a thematic break, not frontmatter', () => {
    expect(markdownToDoc('---').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [{ type: 'horizontalRule', attrs: { marker: null } }],
    })
  })
})
