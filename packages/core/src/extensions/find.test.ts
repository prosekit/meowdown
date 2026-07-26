import { getSearchStatus } from '@prosekit/extensions/search'
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

function setupFind(markdown: string): Fixture {
  const fixture = setupFixture()
  const { n } = fixture
  fixture.set(n.doc(n.paragraph(markdown)))
  return fixture
}

function getSelectedText(fixture: Fixture): string {
  const { from, to } = fixture.state.selection
  return fixture.state.doc.textBetween(from, to)
}

describe('find over hidden source', () => {
  const linkDestination = page.locate('.ProseMirror .md-link-uri')
  const activeMatch = page.locate('.ProseMirror .ProseMirror-active-search-match')

  it('counts a match inside a hidden link destination and reveals it', () => {
    using fixture = setupFind('a [label](https://example.com)')
    expect(getComputedStyle(linkDestination.element()).fontSize).toBe('0px')

    fixture.editor.commands.setSearchQuery({ search: 'example.com', literal: true })

    expect(getSearchStatus(fixture.state)).toEqual({ total: 1, active: 1 })
    expect(getComputedStyle(activeMatch.element()).fontSize).not.toBe('0px')
  })

  it('matches a wiki link by the alias its preview shows', () => {
    using fixture = setupFind('see [[target|Shown label]] here')

    fixture.editor.commands.setSearchQuery({ search: 'shown label', literal: true })

    expect(getSearchStatus(fixture.state)).toEqual({ total: 1, active: 1 })
    expect(getSelectedText(fixture)).toBe('Shown label')
  })
})
