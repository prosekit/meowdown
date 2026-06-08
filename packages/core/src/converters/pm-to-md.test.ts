import { createEditor, type NodeJSON } from '@prosekit/core'
import { describe, expect, it } from 'vitest'

import { defineEditorExtension } from '../extensions/extension.ts'

import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'
import { sampleContent, sampleContentMarkdown } from './sample-content.ts'

const editor = createEditor({ extension: defineEditorExtension() })
const docFromJSON = (json: NodeJSON) => editor.schema.nodeFromJSON(json)

function wrapInDoc(...children: NodeJSON[]): NodeJSON {
  return {
    type: 'doc',
    content: children,
  }
}

function paragraph(text: string): NodeJSON {
  return {
    type: 'paragraph',
    content: text ? [{ type: 'text', text }] : undefined,
  }
}

describe('docToMarkdown', () => {
  it('serializes a paragraph', () => {
    const node = docFromJSON(wrapInDoc(paragraph('hello world')))
    expect(docToMarkdown(node)).toBe('hello world\n')
  })

  it('serializes headings at every level', () => {
    for (let level = 1; level <= 6; level++) {
      const node = docFromJSON(
        wrapInDoc({
          type: 'heading',
          attrs: { level },
          content: [{ type: 'text', text: `Level ${level}` }],
        }),
      )
      expect(docToMarkdown(node)).toBe('#'.repeat(level) + ` Level ${level}\n`)
    }
  })

  it('serializes a blockquote', () => {
    const node = docFromJSON(
      wrapInDoc({
        type: 'blockquote',
        content: [paragraph('quoted text')],
      }),
    )
    expect(docToMarkdown(node)).toBe('> quoted text\n')
  })

  it('serializes a bullet list', () => {
    const item = (text: string): NodeJSON => ({
      type: 'list',
      attrs: { kind: 'bullet', order: null, checked: false, collapsed: false },
      content: [paragraph(text)],
    })
    const node = docFromJSON(wrapInDoc(item('one'), item('two')))
    expect(docToMarkdown(node)).toBe('- one\n\n- two\n')
  })

  it('serializes an ordered list with start number', () => {
    const item = (text: string, order: number): NodeJSON => ({
      type: 'list',
      attrs: { kind: 'ordered', order, checked: false, collapsed: false },
      content: [paragraph(text)],
    })
    const node = docFromJSON(wrapInDoc(item('five', 5), item('six', 5)))
    expect(docToMarkdown(node)).toBe('5. five\n\n5. six\n')
  })

  it('serializes a fenced code block with language', () => {
    const node = docFromJSON(
      wrapInDoc({
        type: 'codeBlock',
        attrs: { language: 'js' },
        content: [{ type: 'text', text: 'console.log(1)' }],
      }),
    )
    expect(docToMarkdown(node)).toBe('```js\nconsole.log(1)\n```\n')
  })

  it('widens the fence when code contains triple-backticks', () => {
    const node = docFromJSON(
      wrapInDoc({
        type: 'codeBlock',
        attrs: { language: '' },
        content: [{ type: 'text', text: '```\nnested fence\n```' }],
      }),
    )
    expect(docToMarkdown(node)).toBe('````\n```\nnested fence\n```\n````\n')
  })

  it('serializes a horizontal rule', () => {
    const node = docFromJSON(wrapInDoc({ type: 'horizontalRule' }))
    expect(docToMarkdown(node)).toBe('---\n')
  })

  it('serializes a GFM table', () => {
    const cell = (text: string, header: boolean): NodeJSON => ({
      type: header ? 'tableHeaderCell' : 'tableCell',
      attrs: { colspan: 1, rowspan: 1, colwidth: null },
      content: [paragraph(text)],
    })
    const node = docFromJSON(
      wrapInDoc({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [cell('A', true), cell('B', true)],
          },
          {
            type: 'tableRow',
            content: [cell('1', false), cell('2', false)],
          },
        ],
      }),
    )
    expect(docToMarkdown(node)).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n')
  })

  it('round-trips sampleContent (doc → md → doc)', () => {
    const node = docFromJSON(sampleContent)
    const md = docToMarkdown(node)
    const back: NodeJSON = markdownToDoc(editor, md).toJSON() as NodeJSON
    expect(back).toEqual(sampleContent)
  })

  it('round-trips sampleContentMarkdown (md → doc → md → doc)', () => {
    // md → doc (one).
    const pm1 = markdownToDoc(editor, sampleContentMarkdown)
    // doc → md → doc; the markdown text may differ in whitespace, but the
    // parsed structure should be stable.
    const md = docToMarkdown(pm1)
    const pm2 = markdownToDoc(editor, md)
    expect(pm2.toJSON()).toEqual(pm1.toJSON())
  })
})
