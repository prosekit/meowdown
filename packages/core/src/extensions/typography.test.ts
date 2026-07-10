import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

describe('left arrow typography', () => {
  it('replaces a trailing `<-` only after a space is typed', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('before <a>after')))
    fixture.view.focus()

    await userEvent.keyboard('<-')
    expect(fixture.doc.textContent).toBe('before <-after')

    await userEvent.keyboard(' ')
    expect(fixture.doc.textContent).toBe('before ← after')
  })

  it('replaces a trailing `<-` before Enter splits the paragraph', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('before <a>after')))
    fixture.view.focus()

    await userEvent.keyboard('<-{Enter}')

    const expected = n.doc(n.paragraph('before ←'), n.paragraph('after'))
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('restores the literal input on an immediate Backspace', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()

    await userEvent.keyboard('<- ')
    expect(fixture.doc.textContent).toBe('← ')

    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.textContent).toBe('<- ')
  })

  it('uses normal Backspace behavior after more text is typed', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()

    await userEvent.keyboard('<- x{Backspace}')
    expect(fixture.doc.textContent).toBe('← ')
  })

  it.each([
    { trigger: 'Space', keys: '<- ', expected: '<- ' },
    { trigger: 'Enter', keys: '<-{Enter}', expected: '<-\n' },
  ])('does not replace `<-` before $trigger inside a code block', async ({ keys, expected }) => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: '' }, '<a>')))
    fixture.view.focus()

    await userEvent.keyboard(keys)
    expect(fixture.doc.textContent).toBe(expected)
  })

  it.each([
    { trigger: 'Space', keys: ' ' },
    { trigger: 'Enter', keys: '{Enter}' },
  ])('does not replace `<-` before $trigger inside inline code', async ({ keys }) => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('`<-<a>`')))
    fixture.view.focus()

    await userEvent.keyboard(keys)
    expect(fixture.doc.textContent).toContain('<-')
    expect(fixture.doc.textContent).not.toContain('←')
  })

  it("does not enable the legacy extension's other typography replacements", async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()

    await userEvent.keyboard('-> -- (c) ')
    expect(fixture.doc.textContent).toBe('-> -- (c) ')
  })
})
