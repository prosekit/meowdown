import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

import { parseWikilinkTarget, findWikilinkAt } from './wikilink-click.ts'

describe('parseWikilinkTarget', () => {
  it.each([
    ['[[Note]]', 'Note'],
    ['[[Note|Alias]]', 'Note'],
    ['[[  Spaced Name  ]]', 'Spaced Name'],
  ])('extracts the target from %s', (input, expected) => {
    expect(parseWikilinkTarget(input)).toBe(expected)
  })
})

describe('findWikilinkAt', () => {
  it('finds the wikilink covering a position', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [[Note]] here')))
    const pos = fixture.doc.textContent.indexOf('Note') + 1
    expect(findWikilinkAt(fixture.state, pos)?.target).toBe('Note')
  })

  it('returns undefined in plain text', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('plain text')))
    expect(findWikilinkAt(fixture.state, 2)).toBeUndefined()
  })
})
