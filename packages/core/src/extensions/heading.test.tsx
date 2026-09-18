import { DOMParser, DOMSerializer } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

const LEVELS = [1, 2, 3, 4, 5, 6] as const

describe('keymap', () => {
  for (const level of LEVELS) {
    it(`Mod-${level} sets heading ${level}`, async () => {
      using fixture = setupFixture()
      const { n } = fixture
      fixture.set(n.doc(n.paragraph('title<a>')))
      fixture.view.focus()
      await userEvent.keyboard(`{ControlOrMeta>}${level}{/ControlOrMeta}`)
      expect(docToMarkdown(fixture.doc)).toBe(`${'#'.repeat(level)} title\n`)
    })
  }

  it('toggles a heading back off with a second Mod-1', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, 'title<a>')))
    fixture.view.focus()
    await userEvent.keyboard(`{ControlOrMeta>}1{/ControlOrMeta}`)
    expect(docToMarkdown(fixture.doc)).toBe('title\n')
  })

  it('does not bind Mod-Alt-1 (dropped in favor of Mod-1)', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('title<a>')))
    fixture.view.focus()
    await userEvent.keyboard(`{ControlOrMeta>}{Alt>}1{/Alt}{/ControlOrMeta}`)
    expect(docToMarkdown(fixture.doc)).toBe('title\n')
  })

  it('turns a heading back into a paragraph on Backspace at its start', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, '<a>title')))
    fixture.view.focus()
    await userEvent.keyboard('{Backspace}')
    expect(docToMarkdown(fixture.doc)).toBe('title\n')
  })
})

describe('soft line break', () => {
  it('declares whitespace: pre', () => {
    using fixture = setupFixture()
    expect(fixture.schema.nodes.heading.spec.whitespace).toBe('pre')
  })

  it('keeps a multi-line setext heading through a DOM round-trip', () => {
    using fixture = setupFixture()
    const { schema, n } = fixture
    const doc = n.doc(n.heading({ level: 1 }, 'Foo bar\nbaz qux'))

    const dom = DOMSerializer.fromSchema(schema).serializeFragment(doc.content)
    const container = document.createElement('div')
    container.appendChild(dom)

    const parsed = DOMParser.fromSchema(schema).parse(container)
    expect(parsed.child(0).textContent).toBe('Foo bar\nbaz qux')
  })
})
