import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

import { findWikilinkAt } from './wikilink-click.ts'
import { parseWikilink } from './wikilink.ts'

describe('parseWikilink', () => {
  it.each([
    ['[[Note]]', 'Note', ''],
    ['[[Note|Alias]]', 'Note', 'Alias'],
    ['[[  Spaced Name  ]]', 'Spaced Name', ''],
    ['[[Note | My Note]]', 'Note', 'My Note'],
  ])('parses %s', (input, target, display) => {
    expect(parseWikilink(input)).toEqual({ target, display })
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
