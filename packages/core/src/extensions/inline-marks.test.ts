import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineEditorExtension } from './extension.ts'
import { MARK_NAMES } from './mark-names.ts'

describe('inline-marks', () => {
  it('editor schema mark names match MARK_NAMES exactly', () => {
    const schema = defineEditorExtension().schema!
    const schemaMarkNames = Object.keys(schema.marks).sort()
    expect(schemaMarkNames).toEqual([...MARK_NAMES].sort())
  })

  it('ranks the pack mark outermost of all, so it wraps the whole unit', () => {
    // mdPack must be the outer DOM wrapper, including outside an image mark view,
    // so a reveal range can cover the entire unit.
    const schema = defineEditorExtension().schema!
    const order = Object.keys(schema.marks)
    expect(order.indexOf('mdPack')).toBeLessThan(order.indexOf('mdImage'))
  })
})

describe('inline mark spellcheck exemption', () => {
  const pmRoot = page.locate('.ProseMirror')

  // An editor showing one paragraph in show mode, so inline source is visible.
  function setup(text: string): Fixture {
    const fixture = setupFixture({ extensionOptions: { markMode: 'show' } })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph(text)))
    return fixture
  }

  it('renders inline code with spellcheck off', async () => {
    using fixture = setup('a `raw code` b')
    void fixture
    const inlineCode = pmRoot.locate('code')
    await expect.element(inlineCode).toHaveAttribute('spellcheck', 'false')
    await expect.element(inlineCode).toHaveAttribute('autocorrect', 'off')
    await expect.element(inlineCode).toHaveAttribute('autocapitalize', 'off')
    await expect.element(inlineCode).toHaveAttribute('writingsuggestions', 'false')
    expect(inlineCode.element().spellcheck).toBe(false)
  })

  it('renders the link destination with spellcheck off', async () => {
    using fixture = setup('[label](https://example.com)')
    void fixture
    const uri = pmRoot.getByText('https://example.com')
    await expect.element(uri).toHaveAttribute('spellcheck', 'false')
    expect(uri.element().spellcheck).toBe(false)
  })
})
