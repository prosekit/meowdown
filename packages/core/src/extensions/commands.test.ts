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

  it('inserts as-is in a code block', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.codeBlock('const a<a>')))

    editor.commands.insertTrigger('/')

    expect(docToMarkdown(fixture.doc)).toBe('```\nconst a/\n```\n')
  })

  it('ignores empty trigger text', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello<a>')))

    expect(editor.commands.insertTrigger('')).toBe(false)

    expect(docToMarkdown(fixture.doc)).toBe('Hello\n')
  })
})
