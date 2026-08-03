import { getSearchStatus } from '@prosekit/extensions/search'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import type { MarkMode } from './mark-mode.ts'

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

// Hide mode keeps a range selection off a hidden run's interior, which would
// otherwise grow the active match and leave prosemirror-search with nothing it
// recognizes to replace.
describe('replacing a find match inside a hidden run', () => {
  function setupReplace(mode: MarkMode): Fixture {
    const fixture = setupFixture({ extensionOptions: { markMode: mode } })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('a [label](https://example.com) b')))
    fixture.editor.commands.setSearchQuery({
      search: 'example.com',
      literal: true,
      replace: 'x.dev',
    })
    return fixture
  }

  it('hide: the active match keeps its own bounds', () => {
    using fixture = setupReplace('hide')
    expect(getSelectedText(fixture)).toBe('example.com')
  })

  it('hide: replaces the match inside a link destination', () => {
    using fixture = setupReplace('hide')
    fixture.editor.commands.replaceCurrent()
    expect(docToMarkdown(fixture.doc)).toBe('a [label](https://x.dev) b\n')
  })

  it('hide: replaceNext walks on to the next match', () => {
    using fixture = setupReplace('hide')
    fixture.editor.commands.replaceNext()
    expect(docToMarkdown(fixture.doc)).toBe('a [label](https://x.dev) b\n')
  })

  it('focus: replaces the match inside a link destination', () => {
    using fixture = setupReplace('focus')
    fixture.editor.commands.replaceCurrent()
    expect(docToMarkdown(fixture.doc)).toBe('a [label](https://x.dev) b\n')
  })

  it('hide: a shift-extended selection still swallows a hidden run whole', async () => {
    using fixture = setupFixture({ extensionOptions: { markMode: 'hide' } })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo **bold** <a>bar')))
    fixture.view.focus()

    await userEvent.keyboard('{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}')
    expect(fixture.selectionSnapshot).toBe('foo **bold❰** ❱bar')
  })
})
