import { createEditor, type NodeJSON } from '@prosekit/core'
import { describe, expect, it } from 'vitest'

import { defineEditorExtension } from '../extensions/extension.ts'
import type { NodeName } from '../extensions/node-names.ts'

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

  it('serializes a bullet list tight', () => {
    const item = (text: string): NodeJSON => ({
      type: 'list',
      attrs: { kind: 'bullet', order: null, checked: false, collapsed: false },
      content: [paragraph(text)],
    })
    const node = docFromJSON(wrapInDoc(item('one'), item('two')))
    expect(docToMarkdown(node)).toBe('- one\n- two\n')
  })

  it('serializes an ordered list tight, with start number', () => {
    const item = (text: string, order: number): NodeJSON => ({
      type: 'list',
      attrs: { kind: 'ordered', order, checked: false, collapsed: false },
      content: [paragraph(text)],
    })
    const node = docFromJSON(wrapInDoc(item('five', 5), item('six', 5)))
    expect(docToMarkdown(node)).toBe('5. five\n5. six\n')
  })

  it('serializes task list items with GFM markers', () => {
    const item = (text: string, checked: boolean): NodeJSON => ({
      type: 'list',
      attrs: { kind: 'task', order: null, checked, collapsed: false },
      content: [paragraph(text)],
    })
    const node = docFromJSON(wrapInDoc(item('todo', false), item('done', true)))
    expect(docToMarkdown(node)).toBe('- [ ] todo\n- [x] done\n')
  })

  it('serializes a list loose when an item holds two blocks', () => {
    const node = docFromJSON(
      wrapInDoc(
        {
          type: 'list',
          attrs: { kind: 'bullet', order: null, checked: false, collapsed: false },
          content: [paragraph('first'), paragraph('second')],
        },
        {
          type: 'list',
          attrs: { kind: 'bullet', order: null, checked: false, collapsed: false },
          content: [paragraph('third')],
        },
      ),
    )
    expect(docToMarkdown(node)).toBe('- first\n\n  second\n\n- third\n')
  })

  it('keeps a blank line between a tight list and the next block', () => {
    const item: NodeJSON = {
      type: 'list',
      attrs: { kind: 'bullet', order: null, checked: false, collapsed: false },
      content: [paragraph('item')],
    }
    const node = docFromJSON(wrapInDoc(item, paragraph('after')))
    expect(docToMarkdown(node)).toBe('- item\n\nafter\n')
  })

  it('keeps an empty bullet between two paragraphs', () => {
    const bullet: NodeJSON = {
      type: 'list',
      attrs: { kind: 'bullet', order: null, checked: false, collapsed: false },
      content: [paragraph('')],
    }
    const node = docFromJSON(wrapInDoc(paragraph('LINE 1'), bullet, paragraph('LINE 2')))
    expect(docToMarkdown(node)).toBe('LINE 1\n\n-\n\nLINE 2\n')
  })

  it('keeps an empty item marker for every list kind', () => {
    const empty = (attrs: Record<string, unknown>): NodeJSON => ({
      type: 'list',
      attrs,
      content: [paragraph('')],
    })
    const bullet = empty({ kind: 'bullet', order: null, checked: false, collapsed: false })
    const task = empty({ kind: 'task', order: null, checked: false, collapsed: false })
    const ordered = empty({ kind: 'ordered', order: 1, checked: false, collapsed: false })
    expect(docToMarkdown(docFromJSON(wrapInDoc(bullet)))).toBe('-\n')
    expect(docToMarkdown(docFromJSON(wrapInDoc(task)))).toBe('- [ ]\n')
    expect(docToMarkdown(docFromJSON(wrapInDoc(ordered)))).toBe('1.\n')
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
    const node = docFromJSON(wrapInDoc({ type: 'horizontalRule' satisfies NodeName }))
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
    const back: NodeJSON = markdownToDoc(md).toJSON() as NodeJSON
    expect(back).toEqual(sampleContent)
  })

  it('round-trips sampleContentMarkdown (md → doc → md → doc)', () => {
    // md → doc (one).
    const pm1 = markdownToDoc(sampleContentMarkdown)
    // doc → md → doc; the markdown text may differ in whitespace, but the
    // parsed structure should be stable.
    const md = docToMarkdown(pm1)
    const pm2 = markdownToDoc(md)
    expect(pm2.toJSON()).toEqual(pm1.toJSON())
  })
})
