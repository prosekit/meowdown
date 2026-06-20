import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'
import { sampleContent, sampleContentMarkdown } from './sample-content.ts'

const fixture = setupFixture({ mount: false })
const { n, schema } = fixture

describe('docToMarkdown', () => {
  it('keeps a paragraph', () => {
    const doc = n.doc(n.paragraph('hello world'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('hello world\n')
  })

  it('keeps a level-1 heading', () => {
    const doc = n.doc(n.heading({ level: 1 }, 'Level 1'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('# Level 1\n')
  })

  it('keeps a level-3 heading', () => {
    const doc = n.doc(n.heading({ level: 3 }, 'Level 3'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('### Level 3\n')
  })

  it('keeps a level-6 heading', () => {
    const doc = n.doc(n.heading({ level: 6 }, 'Level 6'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('###### Level 6\n')
  })

  it('emits a setext level-1 heading', () => {
    const doc = n.doc(n.heading({ level: 1, setextUnderline: 3 }, 'Title'))
    expect(docToMarkdown(doc)).toBe('Title\n===\n')
  })

  it('emits a setext level-2 heading', () => {
    const doc = n.doc(n.heading({ level: 2, setextUnderline: 3 }, 'Title'))
    expect(docToMarkdown(doc)).toBe('Title\n---\n')
  })

  it('keeps the setext underline length', () => {
    const long = n.doc(n.heading({ level: 1, setextUnderline: 9 }, 'Title'))
    expect(docToMarkdown(long)).toBe('Title\n=========\n')
    const short = n.doc(n.heading({ level: 2, setextUnderline: 1 }, 'Title'))
    expect(docToMarkdown(short)).toBe('Title\n-\n')
  })

  it('emits a setext heading deeper than level 2 as ATX', () => {
    const doc = n.doc(n.heading({ level: 3, setextUnderline: 3 }, 'Title'))
    expect(docToMarkdown(doc)).toBe('### Title\n')
  })

  it('emits an empty setext heading as ATX', () => {
    const doc = n.doc(n.heading({ level: 1, setextUnderline: 3 }))
    expect(docToMarkdown(doc)).toBe('#\n')
  })

  it('keeps a blockquote', () => {
    const doc = n.doc(n.blockquote(n.paragraph('quoted text')))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('> quoted text\n')
  })

  it('keeps a tight bullet list', () => {
    const doc = n.doc(
      n.list({ kind: 'bullet' }, n.paragraph('one')),
      n.list({ kind: 'bullet' }, n.paragraph('two')),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- one\n- two\n')
  })

  it('keeps an ordered start number', () => {
    const doc = n.doc(
      n.list({ kind: 'ordered', order: 5 }, n.paragraph('five')),
      n.list({ kind: 'ordered', order: 5 }, n.paragraph('six')),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('5. five\n5. six\n')
  })

  it('keeps task markers', () => {
    const doc = n.doc(
      n.list({ kind: 'task', checked: false }, n.paragraph('todo')),
      n.list({ kind: 'task', checked: true }, n.paragraph('done')),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- [ ] todo\n- [x] done\n')
  })

  it('keeps a loose two-block item', () => {
    const doc = n.doc(
      n.list({ kind: 'bullet' }, n.paragraph('first'), n.paragraph('second')),
      n.list({ kind: 'bullet' }, n.paragraph('third')),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- first\n\n  second\n\n- third\n')
  })

  it('keeps a blank line after a list', () => {
    const doc = n.doc(n.list({ kind: 'bullet' }, n.paragraph('item')), n.paragraph('after'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- item\n\nafter\n')
  })

  it('keeps an empty bullet between paragraphs', () => {
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

  it('keeps a fenced block with language', () => {
    const doc = n.doc(n.codeBlock({ language: 'js' }, 'console.log(1)'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('```js\nconsole.log(1)\n```\n')
  })

  it('keeps code containing triple-backticks', () => {
    const doc = n.doc(n.codeBlock({ language: '' }, '```\nnested fence\n```'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('````\n```\nnested fence\n```\n````\n')
  })

  it('keeps a horizontal rule', () => {
    const doc = n.doc(n.horizontalRule())
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('---\n')
  })

  it('keeps a table', () => {
    const doc = n.doc(
      n.table(
        n.tableRow(n.tableHeaderCell(n.paragraph('A')), n.tableHeaderCell(n.paragraph('B'))),
        n.tableRow(n.tableCell(n.paragraph('1')), n.tableCell(n.paragraph('2'))),
      ),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n')
  })

  it('keeps a nested bullet', () => {
    const doc = n.doc(
      n.list({ kind: 'bullet' }, n.paragraph('a'), n.list({ kind: 'bullet' }, n.paragraph('b'))),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- a\n  - b\n')
  })

  it('keeps a deeply nested bullet', () => {
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

  it('keeps an ordered list in a bullet', () => {
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

  it('keeps a code block in a loose item', () => {
    const doc = n.doc(
      n.list({ kind: 'bullet' }, n.paragraph('a'), n.codeBlock({ language: '' }, 'code')),
    )
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- a\n\n  ```\n  code\n  ```\n')
  })

  it('keeps a rule between paragraphs', () => {
    const doc = n.doc(n.paragraph('a'), n.horizontalRule(), n.paragraph('b'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('a\n\n---\n\nb\n')
  })

  it('keeps the sample document (doc → md → doc)', () => {
    const doc = schema.nodeFromJSON(sampleContent)
    const markdown = docToMarkdown(doc)
    expect(markdownToDoc(markdown).toJSON()).toEqual(sampleContent)
  })

  it('keeps the sample markdown stable (md → doc → md → doc)', () => {
    const doc = markdownToDoc(sampleContentMarkdown)
    const markdown = docToMarkdown(doc)
    expect(markdownToDoc(markdown).toJSON()).toEqual(doc.toJSON())
  })

  it.fails('keeps a list in a quote clean', () => {
    const doc = n.doc(n.blockquote(n.list({ kind: 'bullet' }, n.paragraph('item'))))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('> - item\n')
  })

  it('keeps an empty code block clean', () => {
    const doc = n.doc(n.codeBlock({ language: '' }))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('```\n```\n')
  })

  it('keeps a frontmatter-only document', () => {
    const doc = n.doc({ frontmatter: 'title: x' })
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('---\ntitle: x\n---\n')
  })

  it('keeps frontmatter before content', () => {
    const doc = n.doc({ frontmatter: 'title: x' }, n.heading({ level: 1 }, 'heading'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('---\ntitle: x\n---\n\n# heading\n')
  })

  it('keeps an empty frontmatter block', () => {
    const doc = n.doc({ frontmatter: '' }, n.paragraph('body'))
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('---\n---\n\nbody\n')
  })
})
