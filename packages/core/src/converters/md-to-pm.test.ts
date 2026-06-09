import { createEditor } from '@prosekit/core'
import { describe, expect, it } from 'vitest'

import { defineEditorExtension } from '../extensions/extension.ts'

import { markdownToDoc } from './md-to-pm.ts'
import { sampleContent, sampleContentMarkdown } from './sample-content.ts'

const editor = createEditor({ extension: defineEditorExtension() })

describe('markdownToDoc', () => {
  it('converts a heading', () => {
    expect(markdownToDoc(editor, '# Hello').toJSON()).toEqual({
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
    expect(markdownToDoc(editor, 'hello world').toJSON()).toEqual({
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
    expect(markdownToDoc(editor, '> quoted text').toJSON()).toEqual({
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
    expect(markdownToDoc(editor, '- one\n- two').toJSON()).toEqual({
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
    expect(markdownToDoc(editor, '5. five\n6. six').toJSON()).toEqual({
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
    expect(markdownToDoc(editor, '- [ ] todo').toJSON()).toEqual({
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
    expect(markdownToDoc(editor, '- [x] done').toJSON()).toEqual({
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
    const doc = markdownToDoc(editor, '- [x] done\n- plain').toJSON() as {
      content: Array<{ attrs: { kind: string; checked: boolean } }>
    }
    expect(doc.content.map((item) => item.attrs.kind)).toEqual(['task', 'bullet'])
    expect(doc.content.map((item) => item.attrs.checked)).toEqual([true, false])
  })

  it('keeps a task marker in an ordered list as literal text', () => {
    // The flat-list schema has a single `kind`, so an ordered item cannot
    // also be a task; the marker stays in the text and round-trips verbatim.
    expect(markdownToDoc(editor, '1. [x] done').toJSON()).toEqual({
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
    expect(markdownToDoc(editor, '```js\nconsole.log(1)\n```').toJSON()).toEqual({
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
    expect(markdownToDoc(editor, '---').toJSON()).toEqual({
      type: 'doc',
      content: [{ type: 'horizontalRule' }],
    })
  })

  it('converts a GFM table with a header row', () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |\n'
    expect(markdownToDoc(editor, md).toJSON()).toEqual({
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

  it('round-trips the full sample document', () => {
    expect(markdownToDoc(editor, sampleContentMarkdown).toJSON()).toEqual(sampleContent)
  })
})
