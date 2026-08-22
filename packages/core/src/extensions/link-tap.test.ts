import { isSafari } from '@meowdown/vitest/helpers'
import { describe, expect, it, vi } from 'vitest'

import { setupFixture } from '../testing/index.ts'

import { defineLinkTapHandler, type LinkTapHandler } from './link-tap.ts'

function buildTouch(
  target: Element,
  type: 'touchstart' | 'touchmove' | 'touchend',
  clientX: number,
  clientY: number,
): TouchEvent {
  const touch = new Touch({ identifier: 7, target, clientX, clientY })
  const ended = type === 'touchend'
  return new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: ended ? [] : [touch],
    targetTouches: ended ? [] : [touch],
    changedTouches: [touch],
  })
}

function linkCenter(target: Element): { clientX: number; clientY: number } {
  const rect = target.getBoundingClientRect()
  return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }
}

const cannotConstructTouch = isSafari()

describe('defineLinkTapHandler', () => {
  it.skipIf(cannotConstructTouch)('activates a stationary single-finger tap', () => {
    const onTap = vi.fn<LinkTapHandler>()
    using fixture = setupFixture()
    fixture.editor.use(defineLinkTapHandler(onTap))
    fixture.set(fixture.n.doc(fixture.n.paragraph('[Docs](https://example.com)')))
    const link = fixture.view.dom.querySelector('.md-link')
    if (!link) throw new Error('missing link')
    const center = linkCenter(link)

    link.dispatchEvent(buildTouch(link, 'touchstart', center.clientX, center.clientY))
    const end = buildTouch(link, 'touchend', center.clientX, center.clientY)
    link.dispatchEvent(end)

    expect(end.defaultPrevented).toBe(true)
    expect(onTap).toHaveBeenCalledTimes(1)
    expect(onTap.mock.calls[0]?.[0].link.href).toBe('https://example.com')
  })

  it.skipIf(cannotConstructTouch)('does not activate after scrolling', () => {
    const onTap = vi.fn<LinkTapHandler>()
    using fixture = setupFixture()
    fixture.editor.use(defineLinkTapHandler(onTap))
    fixture.set(fixture.n.doc(fixture.n.paragraph('https://example.com')))
    const link = fixture.view.dom.querySelector('.md-link')
    if (!link) throw new Error('missing link')
    const center = linkCenter(link)

    link.dispatchEvent(buildTouch(link, 'touchstart', center.clientX, center.clientY))
    link.dispatchEvent(buildTouch(link, 'touchmove', center.clientX, center.clientY + 30))
    const end = buildTouch(link, 'touchend', center.clientX, center.clientY + 30)
    link.dispatchEvent(end)

    expect(end.defaultPrevented).toBe(false)
    expect(onTap).not.toHaveBeenCalled()
  })

  it('prevents non-mouse pointer focus on links', () => {
    const onTap = vi.fn<LinkTapHandler>()
    using fixture = setupFixture()
    fixture.editor.use(defineLinkTapHandler(onTap))
    fixture.set(fixture.n.doc(fixture.n.paragraph('https://example.com')))
    const link = fixture.view.dom.querySelector('.md-link')
    if (!link) throw new Error('missing link')

    const event = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
    })
    link.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})
