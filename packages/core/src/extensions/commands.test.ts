import { describe, expect, it } from 'vitest'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

describe('insertMarkdown', () => {
  it('inserts a lone-paragraph fragment inline at the cursor', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello <a>world')))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello world

      """
    `)

    expect(editor.commands.insertMarkdown('brave **new** ')).toBe(true)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello brave **new** world

      """
    `)
  })

  it('collapses an active selection instead of deleting it', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>Hello<b> world')))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello world

      """
    `)

    editor.commands.insertMarkdown('Goodbye ')

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Goodbye Hello world

      """
    `)
  })

  it('inserts a multi-block fragment as blocks with the cursor at its end', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello<a>'), n.paragraph('World')))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      World

      """
    `)

    editor.commands.insertMarkdown('# Title\n\n- item')
    editor.commands.insertText({ text: '!' })

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      # Title

      - item!

      World

      """
    `)
  })

  it('undoes an inserted fragment as a single history entry', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello<a>')))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      """
    `)

    editor.commands.insertMarkdown('# Title\n\n- item')
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      # Title

      - item

      """
    `)

    editor.commands.undo()
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      """
    `)
  })

  it('ignores an empty or whitespace-only fragment', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello<a>')))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      """
    `)

    expect(editor.commands.insertMarkdown('')).toBe(false)
    expect(editor.commands.insertMarkdown('  \n\t ')).toBe(false)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      """
    `)
  })
})

describe('insertTrigger', () => {
  it('inserts the trigger text at the cursor', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello <a>')))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      """
    `)

    expect(editor.commands.insertTrigger('/')).toBe(true)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello /

      """
    `)
  })

  it('prefixes a space after a non-space character', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello<a>')))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      """
    `)

    editor.commands.insertTrigger('[[')

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello [[

      """
    `)
  })

  it('does nothing in a code block', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.codeBlock('const a<a>')))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      \`\`\`
      const a
      \`\`\`

      """
    `)

    expect(editor.commands.insertTrigger('/')).toBe(false)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      \`\`\`
      const a
      \`\`\`

      """
    `)
  })

  it('ignores empty trigger text', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello<a>')))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      """
    `)

    expect(editor.commands.insertTrigger('')).toBe(false)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      """
    `)
  })
})

describe('pastePlainText', () => {
  it('pastes text with Shift-paste semantics: every newline is a paragraph break', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('a<a>b')))

    expect(editor.commands.pastePlainText('xxx\nyyy')).toBe(true)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      axxx

      yyyb

      """
    `)
  })

  it('keeps pasted markdown syntax as literal text', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))

    expect(editor.commands.pastePlainText('**bold** and <b>html</b>')).toBe(true)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      **bold** and <b>html</b>

      """
    `)
  })

  it('ignores empty text', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Hello<a>')))

    expect(editor.commands.pastePlainText('')).toBe(false)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      """
    `)
  })
})

describe('turnIntoText', () => {
  it('turns a heading into a paragraph', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, 'He<a>llo')))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      # Hello

      """
    `)

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      """
    `)
  })

  it('returns false on a plain top-level paragraph', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('He<a>llo')))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      """
    `)

    expect(editor.commands.turnIntoText()).toBe(false)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      Hello

      """
    `)
  })

  it('unwraps a bullet list item', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('a<a>'))))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      - a

      """
    `)

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      a

      """
    `)
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
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      - a
      - b
      - c

      """
    `)

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      - a

      b

      - c

      """
    `)
  })

  it('unwraps a checked task item, dropping the checkbox', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.list({ kind: 'task', checked: true }, n.paragraph('a<a>'))))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      - [x] a

      """
    `)

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      a

      """
    `)
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
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      - a
        - b

      """
    `)

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      - a

        b

      """
    `)
  })

  it('lifts a paragraph out of a blockquote', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.blockquote(n.paragraph('q<a>uote'))))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      > quote

      """
    `)

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      quote

      """
    `)
  })

  it('splits the quote when lifting its middle paragraph', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(
      n.doc(n.blockquote(n.paragraph('one'), n.paragraph('t<a>wo'), n.paragraph('three'))),
    )
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      > one
      >
      > two
      >
      > three

      """
    `)

    expect(editor.commands.turnIntoText()).toBe(true)

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      > one

      two

      > three

      """
    `)
  })

  it('peels a heading inside a list item one layer per call', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.heading({ level: 1 }, 'foo<a>'))))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      - # foo

      """
    `)

    expect(editor.commands.turnIntoText()).toBe(true)
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      - foo

      """
    `)

    expect(editor.commands.turnIntoText()).toBe(true)
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      foo

      """
    `)
  })

  it('peels a list inside a blockquote one layer per call', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.blockquote(n.list({ kind: 'bullet' }, n.paragraph('a<a>')))))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      > - a

      """
    `)

    expect(editor.commands.turnIntoText()).toBe(true)
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      > a

      """
    `)

    expect(editor.commands.turnIntoText()).toBe(true)
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      a

      """
    `)
  })

  it('keeps the caret in the text', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, 'He<a>llo')))
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      # Hello

      """
    `)

    editor.commands.turnIntoText()
    editor.commands.insertText({ text: 'X' })

    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      HeXllo

      """
    `)
  })
})
