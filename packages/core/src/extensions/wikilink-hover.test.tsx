import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

function targets(onHoverChange: ReturnType<typeof vi.fn<WikilinkHoverHandler>>) {
  return onHoverChange.mock.calls.map(([hit]) => hit?.target)
}

// Only the timers the hover handler schedules are faked. Playwright's
// pointer actions poll the page with `requestAnimationFrame`, which stays real.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('wikilink hover callback', () => {
  it('emits one enter while moving among one link label and its children', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('see [[Note|Wide alias]] here', onHoverChange)
    void fixture
    const preview = pmRoot.getByTestId('wikilink')
    const label = preview.locate('.md-wikilink-view-label')

    await preview.hover()
    vi.advanceTimersByTime(300)
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
    vi.advanceTimersByTime(300)
    await links.nth(1).hover()

    expect(targets(onHoverChange)).toEqual(['Alpha', 'Beta'])
  })

  it('leaves when the hovered link is deleted without pointer movement', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('before [[Note]] after', onHoverChange)

    await pmRoot.getByTestId('wikilink').hover()
    vi.advanceTimersByTime(300)
    fixture.set(fixture.n.doc(fixture.n.paragraph('before after')))

    expect(targets(onHoverChange)).toEqual(['Note', undefined])
  })

  it('leaves when the hovered link is replaced', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('[[Alpha]]', onHoverChange)

    await pmRoot.getByTestId('wikilink').hover()
    vi.advanceTimersByTime(300)
    fixture.set(fixture.n.doc(fixture.n.paragraph('[[Beta]]')))

    expect(targets(onHoverChange)).toEqual(['Alpha', undefined])
  })

  it('keeps the same hovered element active through an unrelated transaction', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('before [[Note]]', onHoverChange)

    await pmRoot.getByTestId('wikilink').hover()
    vi.advanceTimersByTime(300)
    fixture.view.dispatch(fixture.state.tr.insertText('new ', 1))

    expect(targets(onHoverChange)).toEqual(['Note'])
  })

  it('leaves when the editor is destroyed', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    {
      using fixture = applyHoverable('[[Note]]', onHoverChange)
      void fixture
      await pmRoot.getByTestId('wikilink').hover()
      vi.advanceTimersByTime(300)
    }

    expect(targets(onHoverChange)).toEqual(['Note', undefined])
  })
})

describe('wikilink hover delays', () => {
  it('enters once the open delay elapses', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('[[Note]]', onHoverChange)
    void fixture

    await pmRoot.getByTestId('wikilink').hover()
    vi.advanceTimersByTime(299)
    expect(onHoverChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(targets(onHoverChange)).toEqual(['Note'])
  })

  it('restarts the open delay when the pointer moves to an adjacent link', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable(
      '[[Alpha|A wide alias]][[Beta|Another wide alias]]',
      onHoverChange,
    )
    void fixture
    const links = pmRoot.getByTestId('wikilink')

    await links.nth(0).hover()
    vi.advanceTimersByTime(200)
    await links.nth(1).hover()
    vi.advanceTimersByTime(299)
    expect(onHoverChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(targets(onHoverChange)).toEqual(['Beta'])
  })

  it('cancels a pending enter when the pointer leaves', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('[[Note]]', onHoverChange)
    void fixture
    const link = pmRoot.getByTestId('wikilink')

    await link.hover()
    vi.advanceTimersByTime(200)
    await link.unhover()
    vi.advanceTimersByTime(1000)

    expect(onHoverChange).not.toHaveBeenCalled()
  })

  it('leaves once the close delay elapses', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('[[Note]]', onHoverChange)
    void fixture
    const link = pmRoot.getByTestId('wikilink')

    await link.hover()
    vi.advanceTimersByTime(300)
    await link.unhover()
    vi.advanceTimersByTime(99)
    expect(targets(onHoverChange)).toEqual(['Note'])
    vi.advanceTimersByTime(1)

    expect(targets(onHoverChange)).toEqual(['Note', undefined])
  })

  it('re-enters without a new open delay when returning within the close delay', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('[[Note]]', onHoverChange)
    void fixture
    const link = pmRoot.getByTestId('wikilink')

    await link.hover()
    vi.advanceTimersByTime(300)
    await link.unhover()
    vi.advanceTimersByTime(50)
    await link.hover()
    vi.advanceTimersByTime(1000)

    expect(targets(onHoverChange)).toEqual(['Note'])
  })

  it('honors custom delays', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('[[Note]]', onHoverChange, 50, 20)
    void fixture
    const link = pmRoot.getByTestId('wikilink')

    await link.hover()
    vi.advanceTimersByTime(49)
    expect(onHoverChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(targets(onHoverChange)).toEqual(['Note'])

    await link.unhover()
    vi.advanceTimersByTime(19)
    expect(targets(onHoverChange)).toEqual(['Note'])
    vi.advanceTimersByTime(1)

    expect(targets(onHoverChange)).toEqual(['Note', undefined])
  })
})
