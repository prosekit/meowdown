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
