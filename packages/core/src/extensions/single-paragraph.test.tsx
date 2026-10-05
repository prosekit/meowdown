import { expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

import { getEditorConfig } from './editor-config-getter.ts'
import { updateEditorConfig } from './editor-config.ts'
import { defineSingleParagraph } from './single-paragraph.ts'

it('keeps typed block prefixes as paragraph content and supports undo', async () => {
  using fixture = setupFixture()
  const { n, editor } = fixture
  editor.use(defineSingleParagraph())
  fixture.set(n.doc(n.paragraph('<a>')))
  fixture.view.focus()
  await userEvent.keyboard('# literal')
  expect(fixture.doc.child(0).type.name).toBe('paragraph')
  expect(fixture.doc.textContent).toBe('# literal')
  editor.commands.undo()
  expect(fixture.doc.textContent).toBe('')
  editor.commands.redo()
  expect(fixture.doc.textContent).toBe('# literal')
})

it('updates external reference definitions without changing paragraph content', async () => {
  using fixture = setupFixture({
    extensionOptions: {
      referenceDefinitions: new Map([
        ['REF', { key: 'REF', href: 'https://example.com/old', title: '' }],
      ]),
    },
  })
  const { n, editor } = fixture
  editor.use(defineSingleParagraph())
  fixture.set(n.doc(n.paragraph('[label][ref]<a>')))
  expect(getEditorConfig(editor.state).referenceDefinitions?.get('REF')?.href).toBe(
    'https://example.com/old',
  )
  const link = page.locate('.ProseMirror').getByRole('link')
  await expect.element(link).toHaveAttribute('href', 'https://example.com/old')
  updateEditorConfig(editor, {
    referenceDefinitions: new Map([
      ['REF', { key: 'REF', href: 'https://example.com/new', title: '' }],
    ]),
  })
  await expect.element(link).toHaveAttribute('href', 'https://example.com/new')
  expect(fixture.doc.textContent).toBe('[label][ref]')
})

it.each(['[ ] ', '[x] ', ' + ', ' - ', '1. ', '> ', '``` '])(
  'keeps the literal prefix %s',
  async (prefix) => {
    using fixture = setupFixture()
    fixture.editor.use(defineSingleParagraph())
    fixture.set(fixture.n.doc(fixture.n.paragraph('<a>')))
    fixture.view.focus()
    await userEvent.type(fixture.view.dom, prefix.replaceAll('[', '[['))
    expect(fixture.doc.childCount).toBe(1)
    expect(fixture.doc.child(0).type.name).toBe('paragraph')
    expect(fixture.doc.textContent).toBe(prefix)
  },
)
