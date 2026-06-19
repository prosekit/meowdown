import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'
import { sampleContent, sampleContentMarkdown } from './sample-content.ts'

const fixture = setupFixture({ mount: false })
const { n, schema } = fixture

describe('docToMarkdown', () => {
  it('serializes a paragraph', () => {
    const doc = n.doc(n.paragraph('hello world'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('hello world\n')
  })

  it('serializes a level-1 heading', () => {
    const doc = n.doc(n.heading({ level: 1 }, 'Level 1'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('# Level 1\n')
  })

  it('serializes a level-3 heading', () => {
    const doc = n.doc(n.heading({ level: 3 }, 'Level 3'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('### Level 3\n')
  })

  it('serializes a level-6 heading', () => {
    const doc = n.doc(n.heading({ level: 6 }, 'Level 6'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('###### Level 6\n')
  })

  it('serializes a blockquote', () => {
    const doc = n.doc(n.blockquote(n.paragraph('quoted text')))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('> quoted text\n')
  })

  it('serializes a bullet list tight', () => {
    const doc = n.doc(
      n.list({ kind: 'bullet' }, n.paragraph('one')),
      n.list({ kind: 'bullet' }, n.paragraph('two')),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- one\n- two\n')
  })

  it('serializes an ordered list tight, with start number', () => {
    const doc = n.doc(
      n.list({ kind: 'ordered', order: 5 }, n.paragraph('five')),
      n.list({ kind: 'ordered', order: 5 }, n.paragraph('six')),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('5. five\n5. six\n')
  })

  it('serializes task list items with GFM markers', () => {
    const doc = n.doc(
      n.list({ kind: 'task', checked: false }, n.paragraph('todo')),
      n.list({ kind: 'task', checked: true }, n.paragraph('done')),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- [ ] todo\n- [x] done\n')
  })

  it('serializes a list loose when an item holds two blocks', () => {
    const doc = n.doc(
      n.list({ kind: 'bullet' }, n.paragraph('first'), n.paragraph('second')),
      n.list({ kind: 'bullet' }, n.paragraph('third')),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- first\n\n  second\n\n- third\n')
  })

  it('keeps a blank line between a tight list and the next block', () => {
    const doc = n.doc(n.list({ kind: 'bullet' }, n.paragraph('item')), n.paragraph('after'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- item\n\nafter\n')
  })

  it('keeps an empty bullet between two paragraphs', () => {
    const doc = n.doc(
      n.paragraph('LINE 1'),
      n.list({ kind: 'bullet' }, n.paragraph()),
      n.paragraph('LINE 2'),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('LINE 1\n\n-\n\nLINE 2\n')
  })

  it('keeps an empty bullet marker', () => {
    const doc = n.doc(n.list({ kind: 'bullet' }, n.paragraph()))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('-\n')
  })

  it('keeps an empty task marker', () => {
    const doc = n.doc(n.list({ kind: 'task', checked: false }, n.paragraph()))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- [ ]\n')
  })

  it('keeps an empty ordered marker', () => {
    const doc = n.doc(n.list({ kind: 'ordered', order: 1 }, n.paragraph()))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('1.\n')
  })

  it('serializes a fenced code block with language', () => {
    const doc = n.doc(n.codeBlock({ language: 'js' }, 'console.log(1)'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('```js\nconsole.log(1)\n```\n')
  })

  it('widens the fence when code contains triple-backticks', () => {
    const doc = n.doc(n.codeBlock({ language: '' }, '```\nnested fence\n```'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('````\n```\nnested fence\n```\n````\n')
  })

  it('serializes a horizontal rule', () => {
    const doc = n.doc(n.horizontalRule())
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('---\n')
  })

  it('serializes a GFM table', () => {
    const doc = n.doc(
      n.table(
        n.tableRow(n.tableHeaderCell(n.paragraph('A')), n.tableHeaderCell(n.paragraph('B'))),
        n.tableRow(n.tableCell(n.paragraph('1')), n.tableCell(n.paragraph('2'))),
      ),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n')
  })

  it('round-trips sampleContent (doc → md → doc)', () => {
    const doc = schema.nodeFromJSON(sampleContent)
    const markdown = docToMarkdown(doc)
    expect(markdownToDoc(markdown).toJSON()).toEqual(sampleContent)
  })

  it('round-trips sampleContentMarkdown (md → doc → md → doc)', () => {
    const doc = markdownToDoc(sampleContentMarkdown)
    const markdown = docToMarkdown(doc)
    expect(markdownToDoc(markdown).toJSON()).toEqual(doc.toJSON())
  })
})

describe('docToMarkdown edge cases', () => {
  it('indents a two-level nested bullet list', () => {
    const doc = n.doc(
      n.list({ kind: 'bullet' }, n.paragraph('a'), n.list({ kind: 'bullet' }, n.paragraph('b'))),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- a\n  - b\n')
  })

  it('indents a three-level nested bullet list', () => {
    const doc = n.doc(
      n.list(
        { kind: 'bullet' },
        n.paragraph('a'),
        n.list({ kind: 'bullet' }, n.paragraph('b'), n.list({ kind: 'bullet' }, n.paragraph('c'))),
      ),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- a\n  - b\n    - c\n')
  })

  it('nests an ordered list inside a bullet item', () => {
    const doc = n.doc(
      n.list(
        { kind: 'bullet' },
        n.paragraph('a'),
        n.list({ kind: 'ordered', order: 1 }, n.paragraph('b')),
      ),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- a\n  1. b\n')
  })

  it('serializes a loose item holding a code block', () => {
    const doc = n.doc(
      n.list({ kind: 'bullet' }, n.paragraph('a'), n.codeBlock({ language: '' }, 'code')),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- a\n\n  ```\n  code\n  ```\n')
  })

  it('serializes a horizontal rule between paragraphs', () => {
    const doc = n.doc(n.paragraph('a'), n.horizontalRule(), n.paragraph('b'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('a\n\n---\n\nb\n')
  })

  it.fails('does not append spurious quote lines after a list in a blockquote', () => {
    const doc = n.doc(n.blockquote(n.list({ kind: 'bullet' }, n.paragraph('item'))))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('> - item\n')
  })

  it.fails('does not add a blank line to an empty code block', () => {
    const doc = n.doc(n.codeBlock({ language: '' }))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('```\n```\n')
  })
})
