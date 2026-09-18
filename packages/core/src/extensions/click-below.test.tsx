import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

const pmRoot = page.locate('.ProseMirror')

async function clickBelowLastBlock(): Promise<void> {
  const rect = pmRoot.element().getBoundingClientRect()
  await userEvent.click(pmRoot, { position: { x: rect.width / 2, y: rect.height - 4 } })
}

describe('a click below the last block', () => {
  it('adds a paragraph below a code block', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock('code')))
    await clickBelowLastBlock()
    await userEvent.keyboard('X')
    expect(fixture.doc.eq(n.doc(n.codeBlock('code'), n.paragraph('X')))).toBe(true)
  })

  it('adds a paragraph below a blockquote', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.blockquote(n.paragraph('quote'))))
    await clickBelowLastBlock()
    await userEvent.keyboard('X')
    expect(fixture.doc.eq(n.doc(n.blockquote(n.paragraph('quote')), n.paragraph('X')))).toBe(true)
  })

  it('adds a paragraph below a list', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('item'))))
    await clickBelowLastBlock()
    await userEvent.keyboard('X')
    const expected = n.doc(n.list({ kind: 'bullet' }, n.paragraph('item')), n.paragraph('X'))
    expect(fixture.doc.eq(expected)).toBe(true)
  })
})
