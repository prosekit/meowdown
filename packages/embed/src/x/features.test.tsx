import './theme.css'

import type { XPost } from '@post-embed/types'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { page, server, userEvent } from 'vitest/browser'

import type { XPostMediaClickDetail } from './media-click.ts'
import { createPhoto, createPost, createVideo } from './testing/fixtures.ts'

import { registerXPost } from './index.ts'

beforeAll(() => registerXPost())
afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function mount(post = createPost()) {
  delete post.author.avatar
  const element = document.createElement('meowdown-embed-x')
  element.dataset.testid = 'feature-post'
  element.data = post
  document.body.append(element)
  return element
}
const post = page.getByTestId('feature-post')

describe('Full post snapshots', () => {
  it('renders photos with alt text and preserves native full-image links', async () => {
    expect(createPhoto().url).toMatch(/^https?:/u)
    const snapshot = createPost('Four pictures')
    snapshot.media = Array.from({ length: 4 }, createPhoto)
    const element = mount(snapshot)
    await expect.element(post.getByText('Four pictures')).toBeVisible()
    const images = element.querySelectorAll<HTMLImageElement>('[data-media] img')
    expect(images).toHaveLength(4)
    expect(images[0].alt).toBe('Blue illustrated mountains')
    expect(images[0].closest('a')?.href).toBe(images[0].src)
    await expect.poll(() => images[0].naturalWidth).toBe(640)
  })

  it('reserves the media aspect ratio before the image loads', () => {
    const snapshot = createPost()
    snapshot.media = [{ ...createPhoto(), url: 'https://example.invalid/a.jpg' }]
    const element = mount(snapshot)
    element.style.width = '500px'
    const image = element.querySelector<HTMLImageElement>('[data-media] img')!
    expect(image.complete && image.naturalWidth > 0).toBe(false)
    const box = image.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeCloseTo((box.width * 400) / 640, 0)
  })

  it('grows a video that plays in place', async () => {
    const snapshot = createPost()
    snapshot.media = [createVideo()]
    const element = mount(snapshot)
    const item = element.querySelector('[data-media-item]')!
    const posterHeight = item.getBoundingClientRect().height
    await post.getByRole('button', { name: 'Play video' }).click()
    expect(item.getBoundingClientRect().height).toBeGreaterThan(posterHeight * 1.5)
  })

  it('plays a video in place after a click on its poster', async () => {
    const snapshot = createPost()
    snapshot.media = [createVideo(), createVideo(true)]
    const element = mount(snapshot)
    expect(element.querySelector('video')).toBeNull()
    await post.getByRole('button', { name: 'Play video' }).click()
    await post.getByRole('button', { name: 'Play GIF' }).click()
    const videos = element.querySelectorAll('video')
    expect(videos).toHaveLength(2)
    expect(videos[0].querySelector('source')?.src).toBe('https://example.com/high.mp4')
    expect(videos[0].controls).toBe(true)
    expect(videos[0].loop).toBe(false)
    expect(videos[1].loop).toBe(true)
    expect(videos[1].muted).toBe(true)
    const pause = vi.spyOn(videos[0], 'pause')
    element.remove()
    expect(pause).toHaveBeenCalled()
    snapshot.media = [createPhoto()]
    element.data = { ...snapshot }
    document.body.append(element)
    expect(element.querySelector('video')).toBeNull()
  })

  it('renders quotes, reply context, and long-post links', async () => {
    const snapshot = createPost('A reply with a quote')
    snapshot.quote = {
      ...createPost('Quote body'),
      id: '222',
      media: [createPhoto()],
    }
    snapshot.replyTo = { handle: 'example', id: '111' }
    snapshot.truncated = true
    mount(snapshot)
    await expect
      .element(post.getByRole('article', { name: 'Quoted post' }).getByText('Quote body'))
      .toBeVisible()
    await expect
      .element(post.getByRole('link', { name: 'Replying to @example' }))
      .toHaveAttribute('href', 'https://x.com/example/status/111')
    await expect.element(post.getByRole('link', { name: 'Show more' })).toBeVisible()
  })

  it('drops blank lines from a quoted post only', () => {
    const snapshot = createPost('First\n\nSecond')
    snapshot.quote = { ...createPost('First\n\nSecond'), id: '222' }
    const element = mount(snapshot)
    const [body, quoted] = element.querySelectorAll<HTMLElement>('[data-text]')
    expect(body.innerText).toBe('First\n\nSecond')
    expect(quoted.innerText).toBe('First\nSecond')
  })

  it('renders dates and edits without engagement controls', async () => {
    const snapshot = createPost()
    snapshot.author.avatarShape = 'square'
    snapshot.edit = 'edited'
    const element = mount(snapshot)
    expect(element.querySelector('time')?.dateTime).toBe('2026-09-10T00:00:00.000Z')
    await expect.element(post.getByText('Edited', { exact: true })).toBeVisible()
    await expect.element(post.getByRole('button')).not.toBeInTheDocument()
    await expect
      .element(post.getByRole('link', { name: /Follow|Like|Reply|Read|on X/ }))
      .not.toBeInTheDocument()
    expect(element.textContent).not.toMatch(/on X/)
  })

  it('links an earlier version of an edited post to the latest one', async () => {
    const snapshot = createPost()
    snapshot.edit = 'stale'
    mount(snapshot)
    await expect
      .element(post.getByRole('link', { name: 'View latest' }))
      .toHaveAttribute('href', 'https://x.com/example/status/1234567890123456789')
  })

  it('rejects unsafe media URLs and survives missing media and invalid dates', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const snapshot = createPost()
    snapshot.createdAt = 'bad-date'
    snapshot.media = [
      { ...createPhoto(), url: 'javascript:alert(1)' },
      { ...createVideo(), sources: [] },
    ]
    const element = mount(snapshot)
    expect(element.querySelector('[data-media] img, video, time')).toBeNull()
    expect(element.querySelectorAll('[data-media-unavailable]')).toHaveLength(2)
    expect(warn).toHaveBeenCalledWith('[meowdown] Ignored unsafe media URL: javascript:alert(1)')
    snapshot.media = [createPhoto()]
    element.data = { ...snapshot }
    const image = element.querySelector<HTMLImageElement>('[data-media] img')!
    image.dispatchEvent(new Event('error'))
    await expect
      .element(post.getByText('Media could not be loaded.', { exact: false }))
      .toBeVisible()
  })

  it('shows a placeholder for media the source marked unavailable', () => {
    const snapshot = createPost()
    snapshot.media = [{ ...createPhoto(), unavailable: true }, createPhoto()]
    const element = mount(snapshot)
    expect(element.querySelectorAll('[data-media-unavailable]')).toHaveLength(1)
    expect(element.querySelectorAll('[data-media] img')).toHaveLength(1)
  })

  it('handles video source errors', async () => {
    const snapshot = createPost()
    snapshot.media = [
      createPhoto(),
      {
        ...createVideo(),
        sources: [{ type: 'video/mp4', url: 'https://example.com/video.mp4' }],
      },
    ]
    const element = mount(snapshot)
    expect(element.querySelectorAll('[data-media-item]')).toHaveLength(2)
    await post.getByRole('button', { name: 'Play video' }).click()
    element.querySelector('source')!.dispatchEvent(new Event('error'))
    await expect
      .element(post.getByText('Media could not be loaded.', { exact: false }).nth(1))
      .toBeVisible()
    expect(element.querySelector('video')?.hidden).toBe(true)
  })

  it('lets a host take over a media click', async () => {
    const snapshot = createPost()
    snapshot.media = [createPhoto(), createVideo()]
    const element = mount(snapshot)
    const details: XPostMediaClickDetail[] = []
    element.addEventListener('meowdown-embed-media-click', (event) => {
      event.preventDefault()
      details.push(event.detail)
    })
    await post.getByRole('img', { name: 'Blue illustrated mountains' }).click()
    await post.getByRole('button', { name: 'Play video' }).click()
    expect(element.querySelector('video')).toBeNull()
    expect(details.map((detail) => detail.index)).toEqual([0, 1])
    expect(details[0].element).toBe(element.querySelector('[data-media] img'))
    expect(details[1].items).toHaveLength(2)
    expect(details[1].media).toMatchObject({
      type: 'video',
      sources: [{ url: 'https://example.com/high.mp4' }, {}, {}],
    })
  })
})

// Clipping needs scroll-driven animations; without them the whole card shows.
const clipSupported = CSS.supports('animation-timeline: scroll()')

describe('Max height', () => {
  const longText = Array.from({ length: 20 }, (_, index) => `Line ${index + 1}`).join('\n')

  function mountLimited(snapshot: XPost, width?: string, parent: HTMLElement = document.body) {
    delete snapshot.author.avatar
    const element = document.createElement('meowdown-embed-x')
    element.dataset.testid = 'feature-post'
    element.style.setProperty('--meowdown-embed-max-height', '300px')
    if (width) element.style.width = width
    element.data = snapshot
    parent.append(element)
    const toggle = element.querySelector<HTMLDetailsElement>('[data-show-more]')!
    return {
      element,
      card: element.querySelector<HTMLElement>('[data-root]')!,
      toggle,
      summary: page.elementLocator(toggle.querySelector('summary')!),
    }
  }

  const heightOf = (card: HTMLElement) => card.getBoundingClientRect().height
  // The label is generated content, which text locators cannot see.
  function isShown(element: Element): boolean {
    return element.checkVisibility() && element.getBoundingClientRect().height > 0
  }

  it.runIf(clipSupported)('clips a card taller than the max height behind Show more', async () => {
    const { card, toggle } = mountLimited(createPost(longText))
    await vi.waitFor(() => expect(heightOf(card)).toBeCloseTo(300, 0))
    await vi.waitFor(() => expect(isShown(toggle)).toBe(true))
    expect(toggle.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      card.getBoundingClientRect().bottom,
    )
  })

  it.runIf(clipSupported)('expands and collapses a clipped card', async () => {
    const { card, toggle, summary } = mountLimited(createPost(longText))
    await vi.waitFor(() => expect(isShown(toggle)).toBe(true))
    await summary.click()
    expect(toggle.open).toBe(true)
    await vi.waitFor(() => expect(heightOf(card)).toBeGreaterThan(400))
    await summary.click()
    expect(toggle.open).toBe(false)
    await vi.waitFor(() => expect(heightOf(card)).toBeCloseTo(300, 0))
  })

  it.runIf(clipSupported)('clips a card made tall by media rather than text', async () => {
    const snapshot = createPost('Four pictures and a quote')
    snapshot.media = Array.from({ length: 4 }, createPhoto)
    snapshot.quote = { ...createPost('Quoted'), id: '222', media: [createPhoto()] }
    const { card, toggle } = mountLimited(snapshot)
    await vi.waitFor(() => expect(heightOf(card)).toBeCloseTo(300, 0))
    await vi.waitFor(() => expect(isShown(toggle)).toBe(true))
  })

  it.runIf(clipSupported)('clips a card that grows taller after a resize', async () => {
    const text = Array.from(
      { length: 7 },
      () => 'A sentence that wraps once the card gets narrow.',
    ).join(' ')
    const { element, card, toggle } = mountLimited(createPost(text), '28rem')
    await expect.element(post.getByText(/^A sentence/)).toBeVisible()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(isShown(toggle)).toBe(false)
    expect(heightOf(card)).toBeLessThan(300)
    element.style.width = '12rem'
    await vi.waitFor(() => expect(isShown(toggle)).toBe(true))
    await vi.waitFor(() => expect(heightOf(card)).toBeCloseTo(300, 0))
  })

  it.runIf(clipSupported)('expands while keyboard focus is inside the card', async () => {
    const snapshot = createPost(`${longText}\n`)
    snapshot.body.push({ type: 'link', text: 'Clipped link', url: 'https://example.com/' })
    const { element, card, toggle } = mountLimited(snapshot)
    await vi.waitFor(() => expect(isShown(toggle)).toBe(true))
    const link = element.querySelector<HTMLAnchorElement>('[data-body] a')!
    for (let i = 0; i < 10 && document.activeElement !== link; i++) {
      if (server.browser === 'webkit' && navigator.platform.includes('Mac')) {
        await userEvent.keyboard('{Alt>}{Tab}{/Alt}')
      } else {
        await userEvent.tab()
      }
    }
    expect(document.activeElement).toBe(link)
    await vi.waitFor(() => expect(heightOf(card)).toBeGreaterThan(400))
    expect(link.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      card.getBoundingClientRect().bottom,
    )
  })

  it.runIf(clipSupported)('keeps Show less in view while the expanded card scrolls', async () => {
    const scroller = document.createElement('div')
    scroller.style.cssText = 'height: 240px; overflow: auto'
    document.body.append(scroller)
    const { toggle, summary } = mountLimited(createPost(longText), undefined, scroller)
    await vi.waitFor(() => expect(isShown(toggle)).toBe(true))
    await summary.click()
    scroller.scrollTop = 0
    await vi.waitFor(() => {
      expect(toggle.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        scroller.getBoundingClientRect().bottom,
      )
    })
  })

  // Fails once Firefox ships scroll-driven animations; then `clipSupported`
  // and the fallback test can go.
  it.runIf(server.browser === 'firefox')('has no clip support in Firefox', () => {
    expect(clipSupported).toBe(false)
  })

  it.runIf(!clipSupported)('shows the whole card without clip support', async () => {
    const { card, toggle } = mountLimited(createPost(longText))
    await expect.element(post.getByText(/Line 20/)).toBeVisible()
    expect(heightOf(card)).toBeGreaterThan(400)
    expect(isShown(toggle)).toBe(false)
  })
})
