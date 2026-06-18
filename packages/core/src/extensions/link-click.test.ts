import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

import { findLinkAt } from './link-click.ts'

describe('findLinkAt', () => {
  it('finds the href of the link covering a position', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [Example](https://example.com) here')))
    const pos = fixture.doc.textContent.indexOf('Example') + 1
    expect(findLinkAt(fixture.state, pos)?.href).toBe('https://example.com')
  })

  it('returns undefined in plain text', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('plain text')))
    expect(findLinkAt(fixture.state, 2)).toBeUndefined()
  })

  it('returns the right href when two links touch', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('[a](https://a.example)[b](https://b.example)')))
    const text = fixture.doc.textContent
    expect(findLinkAt(fixture.state, text.indexOf('a](') + 1)?.href).toBe('https://a.example')
    expect(findLinkAt(fixture.state, text.indexOf('b](') + 1)?.href).toBe('https://b.example')
  })
})
