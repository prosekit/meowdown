import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { LINK_TEXT_MARK_CLASS } from '../class-names.ts'
import { setupFixture } from '../testing/index.ts'

import { updateEditorConfig } from './editor-config.ts'
import { defineLinkHoverHandler, dismissLinkHover, type LinkHoverHandler } from './link-hover.ts'

const markdownLink = page.locate(`.ProseMirror .${LINK_TEXT_MARK_CLASS}`)

function applyHoverable(markdown: string, onHoverChange: LinkHoverHandler) {
  const fixture = setupFixture()
  fixture.editor.use(defineLinkHoverHandler(onHoverChange))
  fixture.set(fixture.n.doc(fixture.n.paragraph(markdown)))
  updateEditorConfig(fixture.editor, { markMode: 'hide' })
  return fixture
}

function buildMouse(type: 'mousedown' | 'mouseup' | 'click', clientX: number, clientY: number) {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY })
}

/**
 * The compatibility sequence a browser synthesizes after recognizing a
 * stationary single-finger tap.
 */
function dispatchTap(target: Element, pointerType = 'touch') {
  const rect = target.getBoundingClientRect()
  const clientX = rect.left + rect.width / 2
  const clientY = rect.top + rect.height / 2
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      pointerId: 7,
      pointerType,
      isPrimary: true,
    }),
  )
  const mousedown = buildMouse('mousedown', clientX, clientY)
  target.dispatchEvent(mousedown)
  target.dispatchEvent(buildMouse('mouseup', clientX, clientY))
  const click = buildMouse('click', clientX, clientY)
  target.dispatchEvent(click)
  return { mousedown, click }
}

describe('Markdown-link hover callback', () => {
  it('keeps the hovered link active through an unrelated transaction', async () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('before [Docs](https://example.com)', onHoverChange)

    await markdownLink.hover()
    await vi.waitFor(() => expect(onHoverChange).toHaveBeenCalled())
    fixture.view.dispatch(fixture.state.tr.insertText('new ', 1))

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.payload.href)).toEqual([
      'https://example.com',
    ])
  })

  it('leaves when the hovered link is deleted without pointer movement', async () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('before [Docs](https://example.com)', onHoverChange)

    await markdownLink.hover()
    await vi.waitFor(() => expect(onHoverChange).toHaveBeenCalled())
    fixture.set(fixture.n.doc(fixture.n.paragraph('before Docs')))

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.payload.href)).toEqual([
      'https://example.com',
      undefined,
    ])
  })

  it('leaves when the hovered link destination is replaced', async () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('[Docs](https://example.com)', onHoverChange)

    await markdownLink.hover()
    await vi.waitFor(() => expect(onHoverChange).toHaveBeenCalled())
    fixture.set(fixture.n.doc(fixture.n.paragraph('[Docs](https://example.org)')))

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.payload.href)).toEqual([
      'https://example.com',
      undefined,
    ])
  })
})

describe('dismissLinkHover', () => {
  // Only the timers the hover handler schedules are faked. Mouse events are
  // dispatched directly, so the fake clock moves only when a test runs timers.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function dispatchMouseOver(target: Element) {
    target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  }

  function dispatchMouseOut(target: Element) {
    target.dispatchEvent(
      new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }),
    )
  }

  it('cancels a pending enter while the pointer stays', () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('[Docs](https://example.com)', onHoverChange)

    dispatchMouseOver(markdownLink.element())
    dismissLinkHover(fixture.state)
    vi.runOnlyPendingTimers()

    expect(onHoverChange).not.toHaveBeenCalled()
  })

  it('leaves an entered link and keeps it silent while the pointer stays', () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('[Docs](https://example.com)', onHoverChange)

    dispatchMouseOver(markdownLink.element())
    vi.runOnlyPendingTimers()
    dismissLinkHover(fixture.state)
    vi.runOnlyPendingTimers()

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.payload.href)).toEqual([
      'https://example.com',
      undefined,
    ])
  })

  it('enters again after the pointer leaves and returns', () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('[Docs](https://example.com)', onHoverChange)
    const link = markdownLink.element()

    dispatchMouseOver(link)
    dismissLinkHover(fixture.state)
    dispatchMouseOut(link)
    dispatchMouseOver(link)
    expect(onHoverChange).not.toHaveBeenCalled()
    vi.runOnlyPendingTimers()

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.payload.href)).toEqual([
      'https://example.com',
    ])
  })

  it('lets a tap enter a dismissed link', () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('[Docs](https://example.com)', onHoverChange)

    dispatchMouseOver(markdownLink.element())
    dismissLinkHover(fixture.state)
    dispatchTap(markdownLink.element())

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.payload.href)).toEqual([
      'https://example.com',
    ])
  })
})

describe('Markdown-link tap callback', () => {
  it('enters immediately from a touch tap and consumes its events', () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('[Docs](https://example.com)', onHoverChange)
    const link = fixture.view.dom.querySelector(`.${LINK_TEXT_MARK_CLASS}`)
    if (!link) throw new Error('missing link')

    const { mousedown, click } = dispatchTap(link)

    expect(mousedown.defaultPrevented).toBe(true)
    expect(click.defaultPrevented).toBe(true)
    expect(onHoverChange).toHaveBeenCalledTimes(1)
    expect(onHoverChange.mock.calls[0]?.[0]?.payload.href).toBe('https://example.com')
  })

  it('leaves immediately when a tap lands outside links', () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('before [Docs](https://example.com)', onHoverChange)
    const link = fixture.view.dom.querySelector(`.${LINK_TEXT_MARK_CLASS}`)
    const paragraph = fixture.view.dom.querySelector('p')
    if (!link || !paragraph) throw new Error('missing target')

    dispatchTap(link)
    const { mousedown } = dispatchTap(paragraph)

    expect(mousedown.defaultPrevented).toBe(false)
    expect(onHoverChange.mock.calls.map(([hit]) => hit?.payload.href)).toEqual([
      'https://example.com',
      undefined,
    ])
  })

  it('leaves mouse and pen input alone', () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('[Docs](https://example.com)', onHoverChange)
    const link = fixture.view.dom.querySelector(`.${LINK_TEXT_MARK_CLASS}`)
    if (!link) throw new Error('missing link')

    for (const pointerType of ['mouse', 'pen']) {
      const { mousedown, click } = dispatchTap(link, pointerType)
      expect(mousedown.defaultPrevented).toBe(false)
      expect(click.defaultPrevented).toBe(false)
    }
    expect(onHoverChange).not.toHaveBeenCalled()
  })

  it('does nothing for a gesture the browser does not turn into a tap', () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('[Docs](https://example.com)', onHoverChange)
    const link = fixture.view.dom.querySelector(`.${LINK_TEXT_MARK_CLASS}`)
    if (!link) throw new Error('missing link')
    const rect = link.getBoundingClientRect()
    const base = {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 2,
      clientY: rect.top + 2,
      pointerId: 7,
      pointerType: 'touch',
      isPrimary: true,
    }

    // A scroll: pointer events fire, but the browser synthesizes no
    // compatibility mouse events and no click.
    link.dispatchEvent(new PointerEvent('pointerdown', base))
    link.dispatchEvent(new PointerEvent('pointermove', { ...base, clientY: base.clientY + 40 }))
    link.dispatchEvent(new PointerEvent('pointercancel', base))

    expect(onHoverChange).not.toHaveBeenCalled()
  })
})
