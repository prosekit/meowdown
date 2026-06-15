import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { findText } from '../testing/find-text.ts'
import { setupFixture } from '../testing/index.ts'
import { marksAt } from '../testing/marks-at.ts'
import { docToMarkdown } from '../converters/pm-to-md.ts'

describe('toggleStrong command', () => {
  it('wraps the selection and re-derives marks', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('say <a>hello<b> end')))
    expect(editor.commands.toggleStrong()).toBe(true)
    expect(fixture.doc.child(0).textContent).toBe('say **hello** end')
    expect(marksAt(fixture.doc, findText(fixture.doc, 'hello') + 1)).toContain('mdStrong')
  })

  it('selects the content, not the delimiters, after wrapping', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>hello<b>')))
    editor.commands.toggleStrong()
    const { from, to } = fixture.state.selection
    expect(fixture.doc.textBetween(from, to)).toBe('hello')
  })

  it('round-trips: toggling twice restores the text', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('say <a>hello<b> end')))
    editor.commands.toggleStrong()
    editor.commands.toggleStrong()
    expect(fixture.doc.child(0).textContent).toBe('say hello end')
  })

  it('one undo restores the original text', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('say <a>hello<b> end')))
    editor.commands.toggleStrong()
    editor.commands.undo()
    expect(fixture.doc.child(0).textContent).toBe('say hello end')
  })

  it('applies per block across a multi-paragraph selection', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>aa'), n.paragraph('bb<b>')))
    editor.commands.toggleStrong()
    expect(fixture.doc.child(0).textContent).toBe('**aa**')
    expect(fixture.doc.child(1).textContent).toBe('**bb**')
  })

  it('mixed state bolds the plain block and leaves the bold one alone', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>**aa**'), n.paragraph('bb<b>')))
    editor.commands.toggleStrong()
    expect(fixture.doc.child(0).textContent).toBe('**aa**')
    expect(fixture.doc.child(1).textContent).toBe('**bb**')
  })

  it('removes across blocks when everything is bold', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>**aa**'), n.paragraph('**bb**<b>')))
    editor.commands.toggleStrong()
    expect(fixture.doc.child(0).textContent).toBe('aa')
    expect(fixture.doc.child(1).textContent).toBe('bb')
  })

  it('works inside headings and blockquotes', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, '<a>title'), n.blockquote(n.paragraph('quote<b>'))))
    editor.commands.toggleStrong()
    expect(fixture.doc.child(0).textContent).toBe('**title**')
    expect(fixture.doc.child(1).textContent).toBe('**quote**')
  })

  it('works inside a table cell', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.table(n.tableRow(n.tableCell(n.paragraph('cell <a>text<b>'))))))
    editor.commands.toggleStrong()
    expect(fixture.doc.child(0).child(0).child(0).child(0).textContent).toBe('cell **text**')
  })

  it('refuses inside code blocks', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: '' }, 'const <a>a<b> = 1')))
    expect(editor.commands.toggleStrong()).toBe(false)
    expect(fixture.doc.child(0).textContent).toBe('const a = 1')
  })

  it('skips the code block inside a wider selection', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(
      n.doc(n.paragraph('<a>aa'), n.codeBlock({ language: '' }, 'code'), n.paragraph('bb<b>')),
    )
    editor.commands.toggleStrong()
    expect(fixture.doc.child(0).textContent).toBe('**aa**')
    expect(fixture.doc.child(1).textContent).toBe('code')
    expect(fixture.doc.child(2).textContent).toBe('**bb**')
  })

  it('refuses on a node selection', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('a'), '<a>', n.horizontalRule()))
    expect(editor.commands.toggleStrong()).toBe(false)
  })
})

describe('toggleStrong caret', () => {
  it('plants a pair, then typing makes it real strong', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    editor.commands.toggleStrong()
    expect(fixture.doc.child(0).textContent).toBe('****')
    editor.commands.insertText({ text: 'x' })
    expect(fixture.doc.child(0).textContent).toBe('**x**')
    expect(marksAt(fixture.doc, findText(fixture.doc, 'x') + 1)).toContain('mdStrong')
  })

  it('toggling right back removes the planted pair', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    editor.commands.toggleStrong()
    editor.commands.toggleStrong()
    expect(fixture.doc.child(0).textContent).toBe('')
  })

  it('hops out of a span, so typing continues unformatted', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('**bo<a>ld**')))
    editor.commands.toggleStrong()
    editor.commands.insertText({ text: 'x' })
    expect(fixture.doc.child(0).textContent).toBe('**bold**x')
  })

  it('hops into a span from its outer edge, so typing extends it', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('**bold**<a> x')))
    editor.commands.toggleStrong()
    editor.commands.insertText({ text: 'y' })
    expect(fixture.doc.child(0).textContent).toBe('**boldy** x')
  })

  it('refuses inside a code span', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('`co<a>de`')))
    expect(editor.commands.toggleStrong()).toBe(false)
  })
})

describe('keymap', () => {
  it('Mod-b toggles strong', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>hello<b>')))
    fixture.view.focus()
    await userEvent.keyboard('{ControlOrMeta>}b{/ControlOrMeta}')
    expect(fixture.doc.child(0).textContent).toBe('**hello**')
  })

  it.each([
    ['b', '**bold**'],
    ['i', '*bold*'],
    ['e', '`bold`'],
  ])('Mod-%s wraps the selection', async (key, expected) => {
    using fixture = setupFixture()
    fixture.set(fixture.n.doc(fixture.n.paragraph('<a>bold<b>')))
    fixture.view.focus()
    await userEvent.keyboard(`{ControlOrMeta>}${key}{/ControlOrMeta}`)
    expect(docToMarkdown(fixture.doc)).toBe(`${expected}\n`)
  })

  it('Mod-Shift-x wraps the selection in ~~', async () => {
    using fixture = setupFixture()
    fixture.set(fixture.n.doc(fixture.n.paragraph('<a>bold<b>')))
    fixture.view.focus()
    await userEvent.keyboard(`{ControlOrMeta>}{Shift>}x{/Shift}{/ControlOrMeta}`)
    expect(docToMarkdown(fixture.doc)).toBe('~~bold~~\n')
  })
})

describe('other constructs', () => {
  it('toggleEm, toggleCode, toggleDel wrap with their delimiters', () => {
    for (const [command, expected] of [
      ['toggleEm', '*hello*'],
      ['toggleCode', '`hello`'],
      ['toggleDel', '~~hello~~'],
    ] as const) {
      using fixture = setupFixture()
      const { editor, n } = fixture
      fixture.set(n.doc(n.paragraph('<a>hello<b>')))
      editor.commands[command]()
      expect(fixture.doc.child(0).textContent).toBe(expected)
    }
  })
})
