import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

// Mirror ProseMirror's own `Mod` resolution so the test holds on every platform.
const mod = /Mac|iP(hone|[oa]d)/u.test(navigator.platform) ? 'Meta' : 'Control'

const LEVELS = [1, 2, 3, 4, 5, 6] as const

describe('heading shortcuts', () => {
  for (const level of LEVELS) {
    it(`Mod-${level} sets heading ${level}`, async () => {
      using fixture = setupFixture()
      fixture.set(fixture.n.doc(fixture.n.paragraph('title<a>')))
      fixture.view.focus()
      await userEvent.keyboard(`{${mod}>}${level}{/${mod}}`)
      expect(docToMarkdown(fixture.doc)).toBe(`${'#'.repeat(level)} title\n`)
    })

    it(`Mod-Alt-${level} sets heading ${level}`, async () => {
      using fixture = setupFixture()
      fixture.set(fixture.n.doc(fixture.n.paragraph('title<a>')))
      fixture.view.focus()
      await userEvent.keyboard(`{${mod}>}{Alt>}${level}{/Alt}{/${mod}}`)
      expect(docToMarkdown(fixture.doc)).toBe(`${'#'.repeat(level)} title\n`)
    })
  }
})

describe('inline toggle shortcuts', () => {
  it.each([
    ['b', '**bold**'],
    ['i', '*bold*'],
    ['e', '`bold`'],
  ])('Mod-%s wraps the selection', async (key, expected) => {
    using fixture = setupFixture()
    fixture.set(fixture.n.doc(fixture.n.paragraph('<a>bold<b>')))
    fixture.view.focus()
    await userEvent.keyboard(`{${mod}>}${key}{/${mod}}`)
    expect(docToMarkdown(fixture.doc)).toBe(`${expected}\n`)
  })

  it('Mod-Shift-x wraps the selection in ~~', async () => {
    using fixture = setupFixture()
    fixture.set(fixture.n.doc(fixture.n.paragraph('<a>bold<b>')))
    fixture.view.focus()
    await userEvent.keyboard(`{${mod}>}{Shift>}x{/Shift}{/${mod}}`)
    expect(docToMarkdown(fixture.doc)).toBe('~~bold~~\n')
  })
})
