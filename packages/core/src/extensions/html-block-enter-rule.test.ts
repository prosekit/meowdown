import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

describe('html block enter rule', () => {
  it('turns an open element start line into an htmlBlock with the caret inside', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<div class="x"><a>')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('hello')
    const expected = n.doc(n.htmlBlock('<div class="x">\nhello'))
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('keeps the start line as content rather than deleting it', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<section><a>')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    const expected = n.doc(n.htmlBlock('<section>\n'))
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('drops the caret into a fresh paragraph after a complete comment', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<!-- note --><a>')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('after')
    const expected = n.doc(n.htmlBlock('<!-- note -->'), n.paragraph('after'))
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('keeps the caret inside an unterminated comment', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<!-- open<a>')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('body')
    const expected = n.doc(n.htmlBlock('<!-- open\nbody'))
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('does not convert an autolink', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<https://example.com><a>')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    // The default Enter splits the paragraph; nothing becomes an htmlBlock.
    expect(fixture.doc.firstChild?.type.name).toBe('paragraph')
  })

  it('does not convert when the caret is not at the end of the line', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<div><a>tail')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    expect(fixture.doc.firstChild?.type.name).toBe('paragraph')
  })

  it('exits the block when Enter is pressed on a trailing blank line', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<div><a>')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    // Inside the block now, on a new line. A second Enter leaves a lone
    // trailing newline; a third exits (the code-block Enter needs `\n\n`).
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{Enter}')
    const doc = fixture.doc
    expect(doc.firstChild?.type.name).toBe('htmlBlock')
    expect(doc.lastChild?.type.name).toBe('paragraph')
  })
})
