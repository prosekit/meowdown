import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

import { getSearchStatus } from './find.ts'

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

describe('find navigation', () => {
  it('selects the first match at or after the caret when the query changes', () => {
    using fixture = setupFind('one two one three one')

    fixture.editor.commands.setSearchQuery('one')

    expect(getSearchStatus(fixture.state)).toEqual({ total: 3, active: 1 })
    expect(getSelectedText(fixture)).toBe('one')
  })

  it('is case-insensitive', () => {
    using fixture = setupFind('Alpha alpha ALPHA')

    fixture.editor.commands.setSearchQuery('alpha')

    expect(getSearchStatus(fixture.state)).toEqual({ total: 3, active: 1 })
    expect(getSelectedText(fixture)).toBe('Alpha')
  })

  it('stays on the current match while the query is refined', () => {
    using fixture = setupFind('alpha beta alphabet alpha')

    fixture.editor.commands.setSearchQuery('alpha')
    expect(getSearchStatus(fixture.state)).toEqual({ total: 3, active: 1 })

    fixture.editor.commands.setSearchQuery('alphab')
    expect(getSearchStatus(fixture.state)).toEqual({ total: 1, active: 1 })

    // Widening the query keeps the match the user is looking at, the same way
    // Chrome's find bar does.
    fixture.editor.commands.setSearchQuery('alpha')
    expect(getSearchStatus(fixture.state)).toEqual({ total: 3, active: 2 })
  })

  it('wraps forward and backward through the matches', () => {
    using fixture = setupFind('one two one three one')

    fixture.editor.commands.setSearchQuery('one')
    fixture.editor.commands.findNext()
    fixture.editor.commands.findNext()
    expect(getSearchStatus(fixture.state)).toEqual({ total: 3, active: 3 })

    fixture.editor.commands.findNext()
    expect(getSearchStatus(fixture.state)).toEqual({ total: 3, active: 1 })

    fixture.editor.commands.findPrev()
    expect(getSearchStatus(fixture.state)).toEqual({ total: 3, active: 3 })
  })

  it('reports no active match after the selection moves off one', () => {
    using fixture = setupFind('one two one')

    fixture.editor.commands.setSearchQuery('one')
    fixture.editor.commands.selectAll()

    expect(getSearchStatus(fixture.state)).toEqual({ total: 2, active: 0 })
  })

  it('clears the matches on an empty query without moving the selection', () => {
    using fixture = setupFind('one two one')

    fixture.editor.commands.setSearchQuery('one')
    fixture.editor.commands.findNext()
    const selection = fixture.selectionSnapshot

    fixture.editor.commands.setSearchQuery('')

    expect(getSearchStatus(fixture.state)).toEqual({ total: 0, active: 0 })
    expect(fixture.selectionSnapshot).toBe(selection)
  })
})

describe('find over hidden source', () => {
  const linkDestination = page.locate('.ProseMirror .md-link-uri')
  const activeMatch = page.locate('.ProseMirror .ProseMirror-active-search-match')

  it('counts a match inside a hidden link destination and reveals it', () => {
    using fixture = setupFind('a [label](https://example.com)')
    expect(getComputedStyle(linkDestination.element()).fontSize).toBe('0px')

    fixture.editor.commands.setSearchQuery('example.com')

    expect(getSearchStatus(fixture.state)).toEqual({ total: 1, active: 1 })
    expect(getComputedStyle(activeMatch.element()).fontSize).not.toBe('0px')
  })

  it('matches a wiki link by the alias its preview shows', () => {
    using fixture = setupFind('see [[target|Shown label]] here')

    fixture.editor.commands.setSearchQuery('shown label')

    expect(getSearchStatus(fixture.state)).toEqual({ total: 1, active: 1 })
    expect(getSelectedText(fixture)).toBe('Shown label')
  })
})
