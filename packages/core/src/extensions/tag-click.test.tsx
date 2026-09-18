import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

import { findTagAt } from './tag-click.ts'

describe('findTagAt', () => {
  it('finds the tag name covering a position', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see #hello here')))
    const pos = fixture.doc.textContent.indexOf('hello') + 1
    expect(findTagAt(fixture.state, pos)?.tag).toBe('hello')
  })

  it('returns undefined in plain text', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('plain text')))
    expect(findTagAt(fixture.state, 2)).toBeUndefined()
  })

  it('returns the right tag when two tags are adjacent', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('#foo #bar')))
    const text = fixture.doc.textContent
    expect(findTagAt(fixture.state, text.indexOf('foo') + 1)?.tag).toBe('foo')
    expect(findTagAt(fixture.state, text.indexOf('bar') + 1)?.tag).toBe('bar')
  })
})
