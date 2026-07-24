import { isFirefox } from '@meowdown/vitest/helpers'
import { DOMParser, DOMSerializer } from '@prosekit/pm/model'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

describe('codeBlock attrs', () => {
  it('keeps `fenceStyle` and `fenceLength` through a DOM round-trip', () => {
    using fixture = setupFixture()
    const { schema, n } = fixture
    const doc = n.doc(n.codeBlock({ language: 'js', fenceStyle: 'tilde', fenceLength: 4 }, 'code'))

    const dom = DOMSerializer.fromSchema(schema).serializeFragment(doc.content)
    const container = document.createElement('div')
    container.appendChild(dom)

    const parsed = DOMParser.fromSchema(schema).parse(container)
    expect(parsed.child(0).attrs).toMatchObject({
      language: 'js',
      fenceStyle: 'tilde',
      fenceLength: 4,
    })
  })
})

describe('tilde fence rules', () => {
  it('creates a tilde code block from `~~~` and Enter', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()
    await userEvent.keyboard('~~~')
    await userEvent.keyboard('{Enter}')
    const expected = n.doc(n.codeBlock({ language: '', fenceStyle: 'tilde' }))
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('creates a tilde code block with a language from `~~~js` and Enter', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()
    await userEvent.keyboard('~~~js')
    await userEvent.keyboard('{Enter}')
    const expected = n.doc(n.codeBlock({ language: 'js', fenceStyle: 'tilde' }))
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('creates a tilde code block from `~~~` and Space', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()
    await userEvent.keyboard('~~~ ')
    const expected = n.doc(n.codeBlock({ language: '', fenceStyle: 'tilde' }))
    expect(fixture.doc.eq(expected)).toBe(true)
  })
})

describe('dollar fence rules', () => {
  it('keeps `fenceStyle: dollar` through a DOM round-trip', () => {
    using fixture = setupFixture()
    const { schema, n } = fixture
    const doc = n.doc(n.codeBlock({ language: 'math', fenceStyle: 'dollar' }, 'E=mc^2'))

    const dom = DOMSerializer.fromSchema(schema).serializeFragment(doc.content)
    const container = document.createElement('div')
    container.appendChild(dom)

    const parsed = DOMParser.fromSchema(schema).parse(container)
    expect(parsed.child(0).attrs).toMatchObject({
      language: 'math',
      fenceStyle: 'dollar',
      fenceLength: null,
    })
  })

  it('creates a math block from `$$` and Enter', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()
    await userEvent.keyboard('$$')
    await userEvent.keyboard('{Enter}')
    const expected = n.doc(n.codeBlock({ language: 'math', fenceStyle: 'dollar' }))
    expect(fixture.doc.eq(expected)).toBe(true)
  })

  it('does not create a math block from `$$` inside other text', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('price $$<a>')))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    expect(fixture.doc.child(0).type.name).toBe('paragraph')
  })
})

const codeTokens = page.locate('.ProseMirror pre code [class*="tok-"]')

describe('typing over code block selections', () => {
  it('keeps the typed text over a partial selection', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'js' }, '<a>const answer = 4<b>2')))
    // The bug only triggers once highlight token spans wrap the code text.
    await expect.element(codeTokens.first(), { timeout: 15000 }).toBeInTheDocument()
    fixture.view.focus()
    await userEvent.keyboard('X')
    const expected = n.doc(n.codeBlock({ language: 'js' }, 'X2'))
    await vi.waitFor(() => {
      expect(fixture.doc.eq(expected)).toBe(true)
    })
  })

  it.skipIf(
    // Firefox edits the text node in place and is not affected.
    isFirefox(),
  ).fails('keeps the typed text over the full code text', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'js' }, '<a>const answer = 42<b>')))
    // The bug only triggers once highlight token spans wrap the code text.
    await expect.element(codeTokens.first(), { timeout: 15000 }).toBeInTheDocument()
    fixture.view.focus()
    await userEvent.keyboard('X')
    const expected = n.doc(n.codeBlock({ language: 'js' }, 'X'))
    await vi.waitFor(() => {
      expect(fixture.doc.eq(expected)).toBe(true)
    })
  })
})
