import { describe, expect, it } from 'vitest'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

describe('insertMarkdown', () => {
  it('inserts a lone-paragraph fragment inline at the cursor', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello <a>world')))

    expect(editor.commands.insertMarkdown('brave **new** ')).toBe(true)

    expect(docToMarkdown(fixture.doc)).toBe('Hello brave **new** world\n')
  })

  it('collapses an active selection instead of deleting it', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>Hello<b> world')))

    editor.commands.insertMarkdown('Goodbye ')

    expect(docToMarkdown(fixture.doc)).toBe('Goodbye Hello world\n')
  })

  it('inserts a multi-block fragment as blocks with the cursor at its end', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello<a>'), n.paragraph('World')))

    editor.commands.insertMarkdown('# Title\n\n- item')
    editor.commands.insertText({ text: '!' })

    expect(docToMarkdown(fixture.doc)).toBe('Hello\n\n# Title\n\n- item!\n\nWorld\n')
  })

  it('undoes an inserted fragment as a single history entry', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello<a>')))

    editor.commands.insertMarkdown('# Title\n\n- item')
    editor.commands.undo()

    expect(docToMarkdown(fixture.doc)).toBe('Hello\n')
  })

  it('ignores an empty or whitespace-only fragment', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello<a>')))

    expect(editor.commands.insertMarkdown('')).toBe(false)
    expect(editor.commands.insertMarkdown('  \n\t ')).toBe(false)

    expect(docToMarkdown(fixture.doc)).toBe('Hello\n')
  })
})

describe('insertTrigger', () => {
  it('inserts the trigger text at the cursor', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello <a>')))

    expect(editor.commands.insertTrigger('/')).toBe(true)

    expect(docToMarkdown(fixture.doc)).toBe('Hello /\n')
  })

  it('prefixes a space after a non-space character', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello<a>')))

    editor.commands.insertTrigger('[[')

    expect(docToMarkdown(fixture.doc)).toBe('Hello [[\n')
  })

  it('does nothing in a code block', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.codeBlock('const a<a>')))

    expect(editor.commands.insertTrigger('/')).toBe(false)

    expect(docToMarkdown(fixture.doc)).toBe('```\nconst a\n```\n')
  })

  it('ignores empty trigger text', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello<a>')))

    expect(editor.commands.insertTrigger('')).toBe(false)

    expect(docToMarkdown(fixture.doc)).toBe('Hello\n')
  })
})

describe('turnIntoText', () => {
  it('turns a heading into a paragraph', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, 'He<a>llo')))

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toBe('Hello\n')
  })

  it('returns false on a plain top-level paragraph', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('He<a>llo')))

    expect(editor.commands.turnIntoText()).toBe(false)

    expect(docToMarkdown(fixture.doc)).toBe('Hello\n')
  })

  it('unwraps a bullet list item', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('a<a>'))))

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toBe('a\n')
  })

  it('unwraps only the middle item of three', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(
      n.doc(
        n.list({ kind: 'bullet' }, n.paragraph('a')),
        n.list({ kind: 'bullet' }, n.paragraph('b<a>')),
        n.list({ kind: 'bullet' }, n.paragraph('c')),
      ),
    )

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toBe('- a\n\nb\n\n- c\n')
  })

  it('unwraps a checked task item, dropping the checkbox', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.list({ kind: 'task', checked: true }, n.paragraph('a<a>'))))

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toBe('a\n')
  })

  it('turns a nested item into a continuation paragraph of its parent', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(
      n.doc(
        n.list(
          { kind: 'bullet' },
          n.paragraph('a'),
          n.list({ kind: 'bullet' }, n.paragraph('b<a>')),
        ),
      ),
    )

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toBe('- a\n\n  b\n')
  })

  it('lifts a paragraph out of a blockquote', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.blockquote(n.paragraph('q<a>uote'))))

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toBe('quote\n')
  })

  it('splits the quote when lifting its middle paragraph', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(
      n.doc(n.blockquote(n.paragraph('one'), n.paragraph('t<a>wo'), n.paragraph('three'))),
    )

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toBe('> one\n\ntwo\n\n> three\n')
  })

  it('peels a heading inside a list item one layer per call', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.heading({ level: 1 }, 'foo<a>'))))

    expect(editor.commands.turnIntoText()).toBe(true)
    expect(docToMarkdown(fixture.doc)).toBe('- foo\n')

    expect(editor.commands.turnIntoText()).toBe(true)
    expect(docToMarkdown(fixture.doc)).toBe('foo\n')
  })

  it('peels a list inside a blockquote one layer per call', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.blockquote(n.list({ kind: 'bullet' }, n.paragraph('a<a>')))))

    expect(editor.commands.turnIntoText()).toBe(true)
    expect(docToMarkdown(fixture.doc)).toBe('> a\n')

    expect(editor.commands.turnIntoText()).toBe(true)
    expect(docToMarkdown(fixture.doc)).toBe('a\n')
  })

  it('keeps the caret in the text', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, 'He<a>llo')))

    editor.commands.turnIntoText()
    editor.commands.insertText({ text: 'X' })

    expect(docToMarkdown(fixture.doc)).toBe('HeXllo\n')
  })
})
