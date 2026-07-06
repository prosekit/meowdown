import dedent from 'dedent'
import { describe, expect, it } from 'vitest'

import type { MeowdownTableCellAttrs, TableColumnAlign } from '../extensions/table-column-align.ts'

import { dedentContinuation, markdownToDoc, measureContentColumn, sliceColumn } from './md-to-pm.ts'
import { sampleContent, sampleContentMarkdown } from './sample-content.ts'

function tableAligns(markdown: string): Array<Array<TableColumnAlign | null | undefined>> {
  const table = markdownToDoc(markdown).child(0)
  const rows: Array<Array<TableColumnAlign | null | undefined>> = []
  for (let r = 0; r < table.childCount; r++) {
    const row = table.child(r)
    const cells: Array<TableColumnAlign | null | undefined> = []
    for (let c = 0; c < row.childCount; c++) {
      cells.push((row.child(c).attrs as MeowdownTableCellAttrs).align)
    }
    rows.push(cells)
  }
  return rows
}

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
  it('materializes empty paragraphs from a blank-line run', () => {
    expect(markdownToDoc('a\n\n\n\nb').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
        { type: 'paragraph' },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'b' }] },
      ],
    })
  })

  it('skips leading and trailing blank lines', () => {
    expect(markdownToDoc('\n\na\n\n\n').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }],
    })
  })

  it('keeps a heading', () => {
    expect(markdownToDoc('# Hello').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'heading',
          attrs: { level: 1, setextUnderline: null, closingHashes: null },
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
            markerGap: 1,
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
            markerGap: 1,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }],
        },
      ],
    })
  })

  it('marks a `+` bullet collapsed and clears the marker', () => {
    const md = dedent`
      + parent
        - child
    `
    expect(markdownToDoc(md).child(0).attrs).toMatchObject({
      kind: 'bullet',
      collapsed: true,
      marker: null,
    })
  })

  it('keeps `-` and `*` bullets expanded', () => {
    expect(markdownToDoc('- a').child(0).attrs).toMatchObject({ collapsed: false, marker: '-' })
    expect(markdownToDoc('* a').child(0).attrs).toMatchObject({ collapsed: false, marker: '*' })
  })

  it('keeps `+ [ ]` as an expanded circle task', () => {
    expect(markdownToDoc('+ [ ] a').child(0).attrs).toMatchObject({
      kind: 'task',
      marker: '+',
      collapsed: false,
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
            markerGap: 1,
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
            markerGap: 1,
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
            markerGap: 1,
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
            markerGap: 1,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }],
        },
      ],
    })
  })

  it('keeps different markers for tasks', () => {
    // `-` parses as a square checkbox task, `+` as a circle checkbox task.
    expect(markdownToDoc('- [x] Square Task\n\n+ [ ] Circle Task').toJSON()).toEqual({
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
            markerGap: 1,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Square Task' }] }],
        },
        {
          type: 'list',
          attrs: {
            kind: 'task',
            order: null,
            checked: false,
            collapsed: false,
            marker: '+',
            taskMarker: null,
            markerGap: 1,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Circle Task' }] }],
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
            markerGap: 1,
          },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '[x] done' }] }],
        },
      ],
    })
  })

  it('keeps a fenced block with language', () => {
    const md = [
      // A code block
      '```js',
      'console.log(1)',
      '```',
    ].join('\n')

    expect(markdownToDoc(md).toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'js', fenceStyle: null, fenceLength: null },
          content: [{ type: 'text', text: 'console.log(1)' }],
        },
      ],
    })
  })

  it('keeps a multiple-line fenced block nested in a list item', () => {
    const md = [
      // A code block inside a list item
      '- x',
      '',
      '  ```',
      '  line1',
      '  line2',
      '  line3',
      '  ```',
    ].join('\n')
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
            markerGap: 1,
          },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'x' }] },
            {
              type: 'codeBlock',
              attrs: { language: '', fenceStyle: null, fenceLength: null },
              content: [{ type: 'text', text: 'line1\nline2\nline3' }],
            },
          ],
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

  it('wraps each table cell text in a single paragraph', () => {
    const md = dedent`
      | a | b |
      |---|---|
      | 1 | 2 |
    `
    const table = markdownToDoc(md).child(0)
    table.descendants((node) => {
      if (node.type.name !== 'tableCell' && node.type.name !== 'tableHeaderCell') return true
      expect(node.childCount).toBe(1)
      expect(node.child(0).type.name).toBe('paragraph')
      return false
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
                  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'a' }],
                    },
                  ],
                },
                {
                  type: 'tableHeaderCell',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
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
                  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '1' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
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

  it('parses column alignment from the delimiter row', () => {
    const md = dedent`
      | a | b | c | d |
      | :-- | :-: | --: | --- |
      | 1 |  | 3 | 4 |
    `
    expect(tableAligns(md)).toEqual([
      ['left', 'center', 'right', null],
      ['left', 'center', 'right', null],
    ])
  })

  it('parses alignment regardless of delimiter width', () => {
    const md = dedent`
      | a | b |
      | :----: | -----: |
      | 1 | 2 |
    `
    expect(tableAligns(md)).toEqual([
      ['center', 'right'],
      ['center', 'right'],
    ])
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
            markerGap: 1,
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
            markerGap: 1,
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
            markerGap: 1,
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
            markerGap: 1,
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
          attrs: { language: '', fenceStyle: 'indented', fenceLength: null },
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
        {
          type: 'codeBlock',
          attrs: { language: '', fenceStyle: 'tilde', fenceLength: null },
          content: [{ type: 'text', text: 'tilde' }],
        },
      ],
    })
  })

  it('keeps a four-character fence length', () => {
    expect(markdownToDoc('````\ncode\n````').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        {
          type: 'codeBlock',
          attrs: { language: '', fenceStyle: null, fenceLength: 4 },
          content: [{ type: 'text', text: 'code' }],
        },
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
      content: [
        { type: 'heading', attrs: { level: 1, setextUnderline: null, closingHashes: null } },
      ],
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
          attrs: { level: 1, setextUnderline: 3, closingHashes: null },
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
          attrs: { level: 2, setextUnderline: 3, closingHashes: null },
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

  it('maps an HTML comment onto an invisible htmlComment node', () => {
    expect(markdownToDoc('<!-- a comment -->').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [{ type: 'htmlComment', attrs: { content: '<!-- a comment -->' } }],
    })
  })

  it('keeps a multi-line HTML comment verbatim on the node', () => {
    expect(markdownToDoc('<!-- line one\nline two -->').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [{ type: 'htmlComment', attrs: { content: '<!-- line one\nline two -->' } }],
    })
  })

  it('separates a comment from adjacent paragraph text', () => {
    // The shape tools rely on: a sentinel comment, body text, and a closing
    // sentinel, with no blank lines between them.
    expect(markdownToDoc('<!-- start -->\nbody text\n<!-- end -->').toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [
        { type: 'htmlComment', attrs: { content: '<!-- start -->' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'body text' }] },
        { type: 'htmlComment', attrs: { content: '<!-- end -->' } },
      ],
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

  it('keeps a list item soft break as a dedented single text node', () => {
    expect(markdownToDoc('- x\n\n  line one\n  line two').toJSON()).toEqual({
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
            markerGap: 1,
          },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'x' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'line one\nline two' }] },
          ],
        },
      ],
    })
  })

  it('keeps YAML frontmatter as a doc attribute', () => {
    // The whole input is the frontmatter block, so the only content is the
    // empty paragraph the schema fills in (it serializes back to nothing).
    expect(markdownToDoc('---\ntitle: x\n---', { frontmatter: true }).toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: 'title: x' },
      content: [{ type: 'paragraph' }],
    })
  })

  it('keeps a multi-line frontmatter body literal before content', () => {
    const md = '---\ntitle: x\ntags: [a, b]\n---\n\n# heading'
    expect(markdownToDoc(md, { frontmatter: true }).toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: 'title: x\ntags: [a, b]' },
      content: [
        {
          type: 'heading',
          attrs: { level: 1, setextUnderline: null, closingHashes: null },
          content: [{ type: 'text', text: 'heading' }],
        },
      ],
    })
  })

  it('keeps an empty frontmatter block as an empty string', () => {
    expect(markdownToDoc('---\n---', { frontmatter: true }).toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: '' },
      content: [{ type: 'paragraph' }],
    })
  })

  it('keeps a lone dashes line as a thematic break, not frontmatter', () => {
    expect(markdownToDoc('---', { frontmatter: true }).toJSON()).toEqual({
      type: 'doc',
      attrs: { frontmatter: null },
      content: [{ type: 'horizontalRule', attrs: { marker: null } }],
    })
  })

  it('leaves a frontmatter block as content when frontmatter is off (default)', () => {
    expect(markdownToDoc('---\ntitle: x\n---').attrs.frontmatter).toBe(null)
  })
})

describe('measureContentColumn', () => {
  it('is 0 at the document start', () => {
    expect(measureContentColumn('hello', 0)).toBe(0)
  })

  it('is 0 at the start of a line', () => {
    expect(measureContentColumn('abc\nx', 4)).toBe(0)
  })

  it('counts the characters before the position', () => {
    expect(measureContentColumn('- item', 2)).toBe(2)
  })

  it('measures only the current line', () => {
    expect(measureContentColumn('abc\n  x', 6)).toBe(2)
  })

  it('counts a tab from column 0 as 4', () => {
    expect(measureContentColumn('\tx', 1)).toBe(4)
  })

  it('counts a tab to the next multiple of 4', () => {
    expect(measureContentColumn('a\tx', 2)).toBe(4)
    expect(measureContentColumn('ab\tx', 3)).toBe(4)
    expect(measureContentColumn('abc\tx', 4)).toBe(4)
  })

  it('accumulates multiple tabs', () => {
    expect(measureContentColumn('\t\tx', 2)).toBe(8)
  })
})

describe('sliceColumn', () => {
  it('drops leading spaces up to the column', () => {
    expect(sliceColumn('  line', 2)).toBe('line')
  })

  it('stops at the first non-whitespace', () => {
    expect(sliceColumn('  line', 8)).toBe('line')
  })

  it('keeps whitespace beyond the column', () => {
    expect(sliceColumn('    deep', 2)).toBe('  deep')
  })

  it('advances a tab to the next multiple of 4', () => {
    expect(sliceColumn('\tx', 4)).toBe('x')
    expect(sliceColumn(' \tx', 4)).toBe('x')
    expect(sliceColumn('  \tx', 4)).toBe('x')
    expect(sliceColumn('   \tx', 4)).toBe('x')
  })

  it('stops once a tab reaches the column', () => {
    expect(sliceColumn('\t\tx', 4)).toBe('\tx')
  })

  it('consumes a whole tab when the column falls mid-tab', () => {
    expect(sliceColumn('\tx', 2)).toBe('x')
  })

  it('returns the line unchanged at column 0', () => {
    expect(sliceColumn('  line', 0)).toBe('  line')
  })
})

describe('dedentContinuation', () => {
  it('returns single-line content unchanged', () => {
    expect(dedentContinuation('hello', 2)).toBe('hello')
  })

  it('returns content unchanged at column 0', () => {
    expect(dedentContinuation('a\n  b', 0)).toBe('a\n  b')
  })

  it('keeps the first line and dedents the rest', () => {
    expect(dedentContinuation('one\n    two', 2)).toBe('one\n  two')
  })

  it('strips the full column from each continuation line', () => {
    expect(dedentContinuation('line one\n  line two\n  line three', 2)).toBe(
      'line one\nline two\nline three',
    )
  })
})
