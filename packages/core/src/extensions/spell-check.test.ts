import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

import { defineSpellCheckPlugin } from './spell-check.ts'

const pmRoot = page.locate('.ProseMirror')

describe('defineSpellCheckPlugin', () => {
  it('applies the value at mount, before any input', async () => {
    using fixture = setupFixture()
    fixture.editor.use(defineSpellCheckPlugin(false))
    await expect.element(pmRoot).toHaveAttribute('spellcheck', 'false')
  })

  it('keeps the attribute through edits', async () => {
    using fixture = setupFixture()
    fixture.editor.use(defineSpellCheckPlugin(true))
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph('helo world')))
    await expect.element(pmRoot).toHaveAttribute('spellcheck', 'true')
    view.dispatch(view.state.tr.insertText('x', 5))
    // Synchronous read on purpose: the attribute must hold right after the
    // edit, not only once a poll settles.
    expect(fixture.dom.spellcheck).toBe(true)
  })

  it('follows the value when the extension is replaced', async () => {
    using fixture = setupFixture()
    const removeExtension = fixture.editor.use(defineSpellCheckPlugin(false))
    await expect.element(pmRoot).toHaveAttribute('spellcheck', 'false')
    removeExtension()
    fixture.editor.use(defineSpellCheckPlugin(true))
    await expect.element(pmRoot).toHaveAttribute('spellcheck', 'true')
  })
})
