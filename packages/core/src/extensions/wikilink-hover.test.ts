import { sleep } from '@ocavue/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { resolveWikilinkAlias, setupFixture } from '../testing/index.ts'

import { updateEditorConfig } from './editor-config.ts'
import { defineWikilinkHoverHandler, type WikilinkHoverHandler } from './wikilink-hover.ts'

const pmRoot = page.locate('.ProseMirror')

function applyHoverable(
  markdown: string,
  onHoverChange: WikilinkHoverHandler,
  openDelay?: number,
  closeDelay?: number,
) {
  const fixture = setupFixture({ extensionOptions: { resolveWikilink: resolveWikilinkAlias } })
  fixture.editor.use(defineWikilinkHoverHandler(onHoverChange, openDelay, closeDelay))
  fixture.set(fixture.n.doc(fixture.n.paragraph(markdown)))
  updateEditorConfig(fixture.editor, { markMode: 'hide' })
  return fixture
}

describe('wikilink hover callback', () => {
  it('emits one enter while moving among one link label and its children', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('see [[Note|Wide alias]] here', onHoverChange)
    void fixture
    const preview = pmRoot.getByTestId('wikilink')
    const label = preview.locate('.md-wikilink-view-label')

    await preview.hover()
    await vi.waitFor(() => expect(onHoverChange).toHaveBeenCalled())
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

  it('switches between adjacent links without a leave', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable(
      '[[Alpha|A wide alias]][[Beta|Another wide alias]]',
      onHoverChange,
    )
    void fixture
    const links = pmRoot.getByTestId('wikilink')

    await links.nth(0).hover()
    await vi.waitFor(() => expect(onHoverChange).toHaveBeenCalled())
    await links.nth(1).hover()

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Alpha', 'Beta'])
  })

  it('leaves when the hovered link is deleted without pointer movement', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('before [[Note]] after', onHoverChange)

    await pmRoot.getByTestId('wikilink').hover()
    await vi.waitFor(() => expect(onHoverChange).toHaveBeenCalled())
    fixture.set(fixture.n.doc(fixture.n.paragraph('before after')))

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Note', undefined])
  })

  it('leaves when the hovered link is replaced', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('[[Alpha]]', onHoverChange)

    await pmRoot.getByTestId('wikilink').hover()
    await vi.waitFor(() => expect(onHoverChange).toHaveBeenCalled())
    fixture.set(fixture.n.doc(fixture.n.paragraph('[[Beta]]')))

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Alpha', undefined])
  })

  it('keeps the same hovered element active through an unrelated transaction', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('before [[Note]]', onHoverChange)

    await pmRoot.getByTestId('wikilink').hover()
    await vi.waitFor(() => expect(onHoverChange).toHaveBeenCalled())
    fixture.view.dispatch(fixture.state.tr.insertText('new ', 1))

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Note'])
  })

  it('leaves when the editor is destroyed', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    {
      using fixture = applyHoverable('[[Note]]', onHoverChange)
      void fixture
      await pmRoot.getByTestId('wikilink').hover()
      await vi.waitFor(() => expect(onHoverChange).toHaveBeenCalled())
    }

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Note', undefined])
  })
})

describe('wikilink hover delays', () => {
  // Park the pointer away from where the previous test left it, so the
  // first hover below is a real move that fires `mouseover`.
  beforeEach(async () => {
    await page.locate('body').hover()
  })

  it('does not enter before the open delay elapses', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('[[Note]]', onHoverChange, 1000)
    void fixture

    await pmRoot.getByTestId('wikilink').hover()
    await sleep(300)
    expect(onHoverChange).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(onHoverChange).toHaveBeenCalled(), { timeout: 2000 })

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Note'])
  })

  it('restarts the open delay when the pointer moves to an adjacent link', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable(
      '[[Alpha|A wide alias]][[Beta|Another wide alias]]',
      onHoverChange,
      1000,
    )
    void fixture
    const links = pmRoot.getByTestId('wikilink')

    await links.nth(0).hover()
    await sleep(300)
    await links.nth(1).hover()
    await vi.waitFor(() => expect(onHoverChange).toHaveBeenCalled(), { timeout: 2000 })

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Beta'])
  })

  it('cancels a pending enter when the pointer leaves', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('[[Note]]', onHoverChange, 300)
    void fixture
    const link = pmRoot.getByTestId('wikilink')

    await link.hover()
    await link.unhover()
    await sleep(600)

    expect(onHoverChange).not.toHaveBeenCalled()
  })

  it('leaves after the close delay and not before', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('[[Note]]', onHoverChange, undefined, 1000)
    void fixture
    const link = pmRoot.getByTestId('wikilink')

    await link.hover()
    await vi.waitFor(() => expect(onHoverChange).toHaveBeenCalled())
    await link.unhover()
    await sleep(300)
    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Note'])
    await vi.waitFor(
      () => {
        expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Note', undefined])
      },
      { timeout: 2000 },
    )
  })

  it('re-enters without a new open delay when returning within the close delay', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('[[Note]]', onHoverChange, undefined, 1000)
    void fixture
    const link = pmRoot.getByTestId('wikilink')

    await link.hover()
    await vi.waitFor(() => expect(onHoverChange).toHaveBeenCalled())
    await link.unhover()
    await link.hover()
    await sleep(1300)

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.target)).toEqual(['Note'])
  })
})
