import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

import { defineWikilinkHoverHandler, type WikilinkHoverHandler } from './wikilink-hover.ts'

const pmRoot = page.locate('.ProseMirror')

function applyHoverable(markdown: string, onHoverChange: WikilinkHoverHandler) {
  const fixture = setupFixture()
  fixture.editor.use(defineWikilinkHoverHandler(onHoverChange))
  fixture.set(fixture.n.doc(fixture.n.paragraph(markdown)))
  fixture.editor.commands.setMarkMode('hide')
  return fixture
}

describe('wiki-link hover callback', () => {
  it('emits one enter while moving among one link label and its children', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('see [[Note|Wide alias]] here', onHoverChange)
    void fixture
    const preview = pmRoot.getByTestId('wikilink')
    const label = preview.locate('.md-wikilink-view-label')

    await preview.hover()
    label.element().dispatchEvent(
      new MouseEvent('mouseover', {
        bubbles: true,
        relatedTarget: preview.element(),
      }),
    )

    expect(onHoverChange).toHaveBeenCalledTimes(1)
    expect(onHoverChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'Note', element: preview.element() }),
    )
  })

  it('leaves one adjacent link before entering the next', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable(
      '[[Alpha|A wide alias]][[Beta|Another wide alias]]',
      onHoverChange,
    )
    void fixture
    const links = pmRoot.getByTestId('wikilink')

    await links.nth(0).hover()
    await links.nth(1).hover()

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual([
      'Alpha',
      undefined,
      'Beta',
    ])
  })

  it('leaves when the hovered link is deleted without pointer movement', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('before [[Note]] after', onHoverChange)

    await pmRoot.getByTestId('wikilink').hover()
    fixture.set(fixture.n.doc(fixture.n.paragraph('before after')))

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Note', undefined])
  })

  it('leaves when the hovered link is replaced', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('[[Alpha]]', onHoverChange)

    await pmRoot.getByTestId('wikilink').hover()
    fixture.set(fixture.n.doc(fixture.n.paragraph('[[Beta]]')))

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Alpha', undefined])
  })

  it('keeps the same hovered element active through an unrelated transaction', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('before [[Note]]', onHoverChange)

    await pmRoot.getByTestId('wikilink').hover()
    fixture.view.dispatch(fixture.state.tr.insertText('new ', 1))

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Note'])
  })

  it('leaves when the editor is destroyed', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    {
      using fixture = applyHoverable('[[Note]]', onHoverChange)
      void fixture
      await pmRoot.getByTestId('wikilink').hover()
    }

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Note', undefined])
  })
})
