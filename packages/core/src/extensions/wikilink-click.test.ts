import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

import {
  defineWikilinkClickHandler,
  findWikilinkAt,
  type WikilinkClickHandler,
} from './wikilink-click.ts'
import { parseWikilink } from './wikilink.ts'

const pmRoot = page.locate('.ProseMirror')

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

  it('resolves adjacent wikilinks to distinct targets by position', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('[[Alpha]][[Beta]]')))
    const { textContent } = fixture.doc
    const alphaPos = textContent.indexOf('Alpha') + 1
    const betaPos = textContent.indexOf('Beta') + 1
    expect(findWikilinkAt(fixture.state, alphaPos)?.target).toBe('Alpha')
    expect(findWikilinkAt(fixture.state, betaPos)?.target).toBe('Beta')
  })
})

describe('wikilink click callback', () => {
  // Render `markdown` in hide mode (so only the label shows) with a click
  // handler attached.
  function applyClickable(
    fixture: Fixture,
    markdown: string,
    onWikilinkClick: WikilinkClickHandler,
  ): void {
    const { editor, n } = fixture
    editor.use(defineWikilinkClickHandler(onWikilinkClick))
    fixture.set(n.doc(n.paragraph(markdown)))
    // After `set`: `setContent` rebuilds the state, resetting the mode.
    editor.commands.setMarkMode('hide')
  }

  it('fires with the target when the label is clicked', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setupFixture()
    applyClickable(fixture, 'see [[Note]] here', onWikilinkClick)
    const label = pmRoot.getByTestId('wikilink')
    await expect.element(label).toBeInTheDocument()
    await userEvent.click(label)
    await vi.waitFor(() => {
      expect(onWikilinkClick).toHaveBeenCalledWith(expect.objectContaining({ target: 'Note' }))
    })
  })

  it('passes the originating MouseEvent', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setupFixture()
    applyClickable(fixture, 'see [[Note]] here', onWikilinkClick)
    await expect.element(pmRoot.getByTestId('wikilink')).toBeInTheDocument()
    await userEvent.click(pmRoot.getByTestId('wikilink'))
    await vi.waitFor(() => expect(onWikilinkClick).toHaveBeenCalled())
    expect(onWikilinkClick.mock.calls[0][0].event).toBeInstanceOf(MouseEvent)
  })

  it('does not fire when plain text is clicked', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setupFixture()
    applyClickable(fixture, 'hello [[Note]] world', onWikilinkClick)
    await expect.element(pmRoot.getByTestId('wikilink')).toBeInTheDocument()
    await userEvent.click(pmRoot.getByText('hello', { exact: false }))
    expect(onWikilinkClick).not.toHaveBeenCalled()
  })

  // Known limitation: clicking the non-editable label resolves the document
  // position from the click coordinates, so a wide alias label can overshoot the
  // source boundary and adjacent `[[a]][[b]]` labels resolve to the neighbor.
  // `findWikilinkAt` itself resolves the right range per position (see the unit
  // test above); a follow-up should resolve label clicks from the mark view's
  // content holder via `posAtDOM`, the way `defineImageClickHandler` does.
})
