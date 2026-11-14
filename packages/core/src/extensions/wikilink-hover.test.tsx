import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { WIKILINK_VIEW_LABEL_CLASS } from '../class-names.ts'
import { resolveWikilinkAlias, setupFixture } from '../testing/index.ts'

import { updateEditorConfig } from './editor-config.ts'
import { defineWikilinkHoverHandler, type WikilinkHoverHandler } from './wikilink-hover.ts'

const pmRoot = page.locate('.ProseMirror')

function applyHoverable(markdown: string, onHoverChange: WikilinkHoverHandler) {
  const fixture = setupFixture({ extensionOptions: { resolveWikilink: resolveWikilinkAlias } })
  fixture.editor.use(defineWikilinkHoverHandler(onHoverChange))
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
    const label = preview.locate(`.${WIKILINK_VIEW_LABEL_CLASS}`)

    await preview.hover()
    vi.runOnlyPendingTimers()
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
    vi.runOnlyPendingTimers()
    await links.nth(1).hover()

    expect(targets(onHoverChange)).toEqual(['Alpha', 'Beta'])
  })

  it('leaves when the hovered link is deleted without pointer movement', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('before [[Note]] after', onHoverChange)

    await pmRoot.getByTestId('wikilink').hover()
    vi.runOnlyPendingTimers()
    fixture.set(fixture.n.doc(fixture.n.paragraph('before after')))

    expect(targets(onHoverChange)).toEqual(['Note', undefined])
  })

  it('leaves when the hovered link is replaced', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('[[Alpha]]', onHoverChange)

    await pmRoot.getByTestId('wikilink').hover()
    vi.runOnlyPendingTimers()
    fixture.set(fixture.n.doc(fixture.n.paragraph('[[Beta]]')))

    expect(targets(onHoverChange)).toEqual(['Alpha', undefined])
  })

  it('keeps the same hovered element active through an unrelated transaction', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    using fixture = applyHoverable('before [[Note]]', onHoverChange)

    await pmRoot.getByTestId('wikilink').hover()
    vi.runOnlyPendingTimers()
    fixture.view.dispatch(fixture.state.tr.insertText('new ', 1))

    expect(targets(onHoverChange)).toEqual(['Note'])
  })

  it('leaves when the editor is destroyed', async () => {
    const onHoverChange = vi.fn<WikilinkHoverHandler>()
    {
      using fixture = applyHoverable('[[Note]]', onHoverChange)
      void fixture
      await pmRoot.getByTestId('wikilink').hover()
      vi.runOnlyPendingTimers()
    }

    expect(targets(onHoverChange)).toEqual(['Note', undefined])
  })
})
