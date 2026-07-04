import { DOMParser, DOMSerializer } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

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
