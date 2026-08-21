import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { findText } from '../testing/find-text.ts'
import { setupFixture, type SetupFixtureOptions } from '../testing/index.ts'
import { marksAt } from '../testing/marks-at.ts'

const pmRoot = page.locate('.ProseMirror')

function setupEditor(options?: SetupFixtureOptions) {
  const fixture = setupFixture(options)
  fixture.view.focus()
  return fixture
}

async function pressShiftEnter(): Promise<void> {
  await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
}

describe('one press inserts a soft break', () => {
  it('inserts a newline in the middle of a paragraph', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo<a>bar')))
    await pressShiftEnter()
    expect(fixture.doc.eq(n.doc(n.paragraph('foo\nbar')))).toBe(true)
    expect(docToMarkdown(fixture.doc)).toBe('foo\nbar\n')
  })

  it('leaves the caret after the newline', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo<a>bar')))
    await pressShiftEnter()
    await userEvent.keyboard('baz')
    expect(fixture.doc.eq(n.doc(n.paragraph('foo\nbazbar')))).toBe(true)
  })

  it('indents the continuation line of a list item', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('foo<a>bar'))))
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('- foo\n  bar\n')
  })

  it('carries the blockquote marker onto the continuation line', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.blockquote(n.paragraph('foo<a>bar'))))
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('> foo\n> bar\n')
  })

  it('keeps one inline unit across a break inside it', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo **ba<a>r** qux')))
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('foo **ba\nr** qux\n')
    const breakPos = findText(fixture.doc, '\n')
    expect(marksAt(fixture.doc, breakPos + 1)).toContain('mdStrong')
  })

  it('replaces a non-empty selection', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo <a>bar<b> qux')))
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('foo \n qux\n')
  })
})

describe('a second press splits the block', () => {
  it('splits a paragraph and consumes the pending break', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo<a>bar')))
    await pressShiftEnter()
    await pressShiftEnter()
    expect(fixture.doc.eq(n.doc(n.paragraph('foo'), n.paragraph('bar')))).toBe(true)
  })

  it('leaves the caret at the start of the new paragraph', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo<a>bar')))
    await pressShiftEnter()
    await pressShiftEnter()
    await userEvent.keyboard('baz')
    expect(fixture.doc.eq(n.doc(n.paragraph('foo'), n.paragraph('bazbar')))).toBe(true)
  })

  it('splits a bullet item into two items', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('foo<a>bar'))))
    await pressShiftEnter()
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('- foo\n- bar\n')
  })

  it('keeps the task kind on the new item', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'task' }, n.paragraph('foo<a>bar'))))
    await pressShiftEnter()
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('- [ ] foo\n- [ ] bar\n')
  })

  it('keeps the ordered marker on the new item', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'ordered', order: 1 }, n.paragraph('foo<a>bar'))))
    await pressShiftEnter()
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('1. foo\n1. bar\n')
  })

  it('keeps a nested item at its own depth', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list(
          { kind: 'bullet' },
          n.paragraph('parent'),
          n.list({ kind: 'bullet' }, n.paragraph('foo<a>bar')),
        ),
      ),
    )
    await pressShiftEnter()
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('- parent\n  - foo\n  - bar\n')
  })

  it('opens a new item after a collapsed bullet without moving its children', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list(
          { kind: 'bullet', collapsed: true },
          n.paragraph('foo<a>'),
          n.list({ kind: 'bullet' }, n.paragraph('child')),
        ),
      ),
    )
    await pressShiftEnter()
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('+ foo\n  - child\n\n-\n')
  })

  it('splits a blockquote into two quoted paragraphs', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.blockquote(n.paragraph('foo<a>bar'))))
    await pressShiftEnter()
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('> foo\n>\n> bar\n')
  })

  it('opens an empty paragraph at the end of a paragraph', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo<a>')))
    await pressShiftEnter()
    await pressShiftEnter()
    expect(fixture.doc.eq(n.doc(n.paragraph('foo'), n.paragraph()))).toBe(true)
  })

  it('splits an empty paragraph into two', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    await pressShiftEnter()
    await pressShiftEnter()
    expect(fixture.doc.eq(n.doc(n.paragraph(), n.paragraph()))).toBe(true)
  })

  it('splits on a break that opens the paragraph', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('\n<a>bar')))
    await pressShiftEnter()
    expect(fixture.doc.eq(n.doc(n.paragraph(), n.paragraph('bar')))).toBe(true)
  })

  it('splits beside a hidden unit in hide mode', async () => {
    using fixture = setupEditor({ extensionOptions: { markMode: 'hide' } })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo **bar**<a> qux')))
    await pressShiftEnter()
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('foo **bar**\n\n qux\n')
  })

  it('splits from the end of the line in front of a break', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo<a>\nbar')))
    await pressShiftEnter()
    expect(fixture.doc.eq(n.doc(n.paragraph('foo'), n.paragraph('bar')))).toBe(true)
  })

  it('lands the caret in the same place from either side of a break', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo<a>\nbar')))
    await pressShiftEnter()
    await userEvent.keyboard('baz')
    expect(fixture.doc.eq(n.doc(n.paragraph('foo'), n.paragraph('bazbar')))).toBe(true)
  })

  it('splits a list item from the end of the line in front of a break', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('foo<a>\nbar'))))
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('- foo\n- bar\n')
  })

  it('undoes both presses in one step', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo<a>bar')))
    await pressShiftEnter()
    await pressShiftEnter()
    await userEvent.keyboard('{Meta>}z{/Meta}')
    expect(fixture.doc.eq(n.doc(n.paragraph('foobar')))).toBe(true)
  })
})

describe('a code block behaves like Enter', () => {
  it('writes a newline on every press', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'js' }, 'foo<a>bar')))
    await pressShiftEnter()
    await pressShiftEnter()
    expect(fixture.doc.eq(n.doc(n.codeBlock({ language: 'js' }, 'foo\n\nbar')))).toBe(true)
  })

  it('matches what Enter writes at the same caret', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'js' }, 'foo<a>bar')))
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{Enter}')
    expect(fixture.doc.eq(n.doc(n.codeBlock({ language: 'js' }, 'foo\n\nbar')))).toBe(true)
  })
})

describe('declines where markdown cannot hold a break', () => {
  function setupTable(fixture: ReturnType<typeof setupEditor>, caret: 'body' | 'header') {
    const { n } = fixture
    fixture.set(
      n.doc(
        n.table(
          n.tableRow(
            n.tableHeaderCell(n.paragraph(caret === 'header' ? 'a<a>b' : 'ab')),
            n.tableHeaderCell(n.paragraph('c')),
          ),
          n.tableRow(
            n.tableCell(n.paragraph(caret === 'body' ? 'x<a>y' : 'xy')),
            n.tableCell(n.paragraph('2')),
          ),
        ),
      ),
    )
  }

  it('leaves a body cell alone', async () => {
    using fixture = setupEditor()
    setupTable(fixture, 'body')
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('| ab | c |\n| --- | --- |\n| xy | 2 |\n')
  })

  it('leaves a header cell alone', async () => {
    using fixture = setupEditor()
    setupTable(fixture, 'header')
    await pressShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('| ab | c |\n| --- | --- |\n| xy | 2 |\n')
  })

  it('leaves a heading alone', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 2 }, 'foo<a>bar')))
    await pressShiftEnter()
    expect(fixture.doc.eq(n.doc(n.heading({ level: 2 }, 'foobar')))).toBe(true)
  })
})

describe('the insertSoftBreak command', () => {
  it('matches two key presses', () => {
    using fixture = setupEditor()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('foo<a>bar')))
    editor.commands.insertSoftBreak()
    editor.commands.insertSoftBreak()
    expect(fixture.doc.eq(n.doc(n.paragraph('foo'), n.paragraph('bar')))).toBe(true)
  })

  it('reports the guard through canExec', () => {
    using fixture = setupEditor()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('foo<a>bar')))
    expect(editor.commands.insertSoftBreak.canExec()).toBe(true)
    fixture.set(n.doc(n.heading({ level: 2 }, 'foo<a>bar')))
    expect(editor.commands.insertSoftBreak.canExec()).toBe(false)
  })

  it('reports canExec on a caret that would split', () => {
    using fixture = setupEditor()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('foo\n<a>bar')))
    expect(editor.commands.insertSoftBreak.canExec()).toBe(true)
  })
})

describe('rendering', () => {
  it('paints the break as a new line', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo<a>bar')))
    const root = pmRoot.element()
    const before = root.getBoundingClientRect().height
    await pressShiftEnter()
    await expect.poll(() => root.getBoundingClientRect().height).toBeGreaterThan(before)
  })
})
