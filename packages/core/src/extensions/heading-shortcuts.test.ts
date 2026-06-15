import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

const heading = page.locate('.ProseMirror h1')

// Mirror ProseMirror's own `Mod` resolution so the test holds on every platform.
const mod = /Mac|iP(hone|[oa]d)/u.test(navigator.platform) ? 'Meta' : 'Control'

async function pressModKey(key: string): Promise<void> {
  await userEvent.keyboard(`{${mod}>}${key}{/${mod}}`)
}

describe('defineHeadingShortcuts', () => {
  it('toggles a heading on and off with Mod-1', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('title<a>')))
    fixture.view.focus()

    await pressModKey('1')
    await expect.element(heading).toHaveTextContent('title')
    expect(docToMarkdown(fixture.doc)).toBe('# title\n')

    await pressModKey('1')
    await expect.element(heading).not.toBeInTheDocument()
    expect(docToMarkdown(fixture.doc)).toBe('title\n')
  })

  it('sets the level with Mod-2', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('title<a>')))
    fixture.view.focus()

    await pressModKey('2')
    expect(docToMarkdown(fixture.doc)).toBe('## title\n')
  })

  it('still binds ProseKit Mod-Alt-1', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('title<a>')))
    fixture.view.focus()

    await userEvent.keyboard(`{${mod}>}{Alt>}1{/Alt}{/${mod}}`)
    expect(docToMarkdown(fixture.doc)).toBe('# title\n')
  })
})
