import './theme.css'

import type { YouTubeVideo } from '@post-embed/types'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { createVideo } from './testing/fixtures.ts'

import { registerYouTubeVideo, type YouTubeVideoElement } from './index.ts'

beforeAll(() => {
  registerYouTubeVideo()
})

function mount(data = createVideo()) {
  const element = document.createElement('meowdown-embed-youtube')
  element.dataset.testid = 'video'
  element.data = data
  document.body.append(element)
  return element
}

const video = page.getByTestId('video')
const watchUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=90'

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('YouTube video', () => {
  it('renders a light DOM card with watch links and no iframe', async () => {
    const element = mount()
    await expect
      .element(video.getByRole('link', { name: 'Big Buck Bunny' }))
      .toHaveAttribute('href', watchUrl)
    await expect
      .element(video.getByRole('link', { name: 'Blender' }))
      .toHaveAttribute('href', 'https://www.youtube.com/@BlenderOfficial')
    const poster = element.querySelector('[data-poster]')
    expect(poster?.tagName).toBe('A')
    expect(poster?.getAttribute('href')).toBe(watchUrl)
    const image = poster?.querySelector('img')
    expect(image?.getAttribute('referrerpolicy')).toBe('no-referrer')
    await expect.poll(() => image?.naturalWidth).toBe(480)
    expect(element.querySelector('iframe')).toBeNull()
    expect(element.querySelector('button')).toBeNull()
    expect(element.shadowRoot).toBeNull()
    expect(element.querySelector('[style]')).toBeNull()
    expect(element.textContent).not.toContain('aqz-KE-bpKQ&t=90')
  })

  it('loads the player only after a click in inline mode', async () => {
    const element = mount()
    element.playback = 'inline'
    const play = video.getByRole('button', { name: 'Play: Big Buck Bunny' })
    await expect.element(play).toBeVisible()
    expect(element.querySelector('iframe')).toBeNull()
    await userEvent.click(play)
    const frame = video.getByTitle('Big Buck Bunny')
    await expect
      .element(frame)
      .toHaveAttribute(
        'src',
        'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?autoplay=1&playsinline=1&start=90',
      )
    expect(element.querySelector('iframe')?.getAttribute('allow')).toContain('autoplay')
    expect(element.querySelector('button')).toBeNull()
    await expect.poll(() => document.activeElement).toBe(element.querySelector('iframe'))
    await expect.element(video.getByRole('link', { name: 'Big Buck Bunny' })).toBeVisible()
  })

  it('reads playback from the attribute', async () => {
    const element = document.createElement('meowdown-embed-youtube')
    element.dataset.testid = 'video'
    element.setAttribute('playback', 'inline')
    element.data = createVideo()
    document.body.append(element)
    await expect.element(video.getByRole('button', { name: 'Play: Big Buck Bunny' })).toBeVisible()
    element.setAttribute('playback', 'link')
    await expect
      .element(video.getByRole('button', { name: 'Play: Big Buck Bunny' }))
      .not.toBeInTheDocument()
    await expect.element(video.getByRole('link', { name: 'Big Buck Bunny' })).toBeVisible()
  })

  it('marks Shorts as portrait', async () => {
    const element = mount()
    expect(element.querySelector('article')?.hasAttribute('data-orientation')).toBe(false)
    // oEmbed reports the same 200x113 player size for Shorts, so the URL is
    // the only signal.
    element.data = createVideo('https://www.youtube.com/shorts/aqz-KE-bpKQ')
    await expect
      .element(video.getByRole('link', { name: 'Big Buck Bunny' }))
      .toHaveAttribute('href', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ')
    expect(element.querySelector('article')?.getAttribute('data-orientation')).toBe('portrait')
  })

  it('renders unsafe author destinations as text', async () => {
    mount({ ...createVideo(), author_url: 'javascript:alert(1)' })
    await expect.element(video.getByText('Blender')).toBeVisible()
    await expect.element(video.getByRole('link', { name: 'Blender' })).not.toBeInTheDocument()
  })

  it('falls back for unsupported URLs, missing data, and invalid data', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const element = mount(createVideo('https://example.com/video'))
    await expect.element(video.getByText('This video is unavailable.')).toBeVisible()
    expect(element.querySelector('[data-fallback]')).not.toBeNull()
    expect(element.querySelector('a')).toBeNull()
    expect(error).not.toHaveBeenCalled()
    element.data = createVideo()
    await expect.element(video.getByRole('link', { name: 'Big Buck Bunny' })).toBeVisible()
    element.data = null
    await expect.element(video.getByText('This video is unavailable.')).toBeVisible()
    expect(error).not.toHaveBeenCalled()
    Reflect.set(element, 'data', 42)
    await expect.element(video.getByText('This video is unavailable.')).toBeVisible()
    expect(error).toHaveBeenCalledWith('[meowdown] Invalid YouTube video data:', expect.any(Array))
    element.data = createVideo()
    await expect.element(video.getByRole('link', { name: 'Big Buck Bunny' })).toBeVisible()
  })

  it('reconnects with the latest data and preserves host children', async () => {
    const element = mount()
    const annotation = document.createElement('span')
    annotation.textContent = 'Host annotation'
    element.append(annotation)
    await expect.element(video.getByRole('link', { name: 'Big Buck Bunny' })).toBeVisible()
    element.remove()
    element.data = { ...createVideo(), title: 'Reconnected' }
    document.body.append(element)
    await expect.element(video.getByRole('link', { name: 'Reconnected' })).toBeVisible()
    await expect.element(video.getByText('Host annotation')).toBeVisible()
    expect(element.children.length).toBe(2)
  })

  it('keeps registration idempotent and supports custom names', async () => {
    const constructor = customElements.get('meowdown-embed-youtube')
    registerYouTubeVideo()
    expect(customElements.get('meowdown-embed-youtube')).toBe(constructor)
    registerYouTubeVideo('custom-youtube-video')
    const element = document.createElement('custom-youtube-video') as YouTubeVideoElement
    element.dataset.testid = 'custom-video'
    element.data = createVideo()
    document.body.append(element)
    await expect
      .element(page.getByTestId('custom-video').getByRole('link', { name: 'Big Buck Bunny' }))
      .toBeVisible()
    await expect
      .element(page.getByTestId('custom-video'))
      .toHaveAttribute('data-meowdown-embed', 'youtube')
  })

  it('applies the theme and inherits custom properties', async () => {
    const wrapper = document.createElement('div')
    wrapper.style.setProperty('--meowdown-embed-radius', '24px')
    document.body.append(wrapper)
    const element = mount()
    wrapper.append(element)
    await expect.element(video.getByRole('link', { name: 'Big Buck Bunny' })).toBeVisible()
    const poster = element.querySelector('[data-poster]')
    const image = element.querySelector('[data-poster] img')
    if (!poster || !image) throw new Error('Missing rendered video parts')
    expect(getComputedStyle(poster).borderRadius).toBe('24px')
    expect(getComputedStyle(image).objectFit).toBe('cover')
  })
})

describe('YouTube video fetch', () => {
  it('calls `resolver` with `url` and renders the resolved snapshot', async () => {
    let resolve!: () => void
    const resolver = vi.fn((url: string) => {
      return new Promise<YouTubeVideo>((r) => {
        resolve = () => r(createVideo(url))
      })
    })
    const element = document.createElement('meowdown-embed-youtube')
    element.dataset.testid = 'video'
    element.url = watchUrl
    element.resolver = resolver
    document.body.append(element)
    await expect.element(video.getByText('Loading this video…')).toBeVisible()
    resolve()
    await expect
      .element(video.getByRole('link', { name: 'Big Buck Bunny' }))
      .toHaveAttribute('href', watchUrl)
    expect(resolver).toHaveBeenCalledWith(watchUrl)
    expect(element.data).toBeNull()
    element.url = null
    await expect.element(video.getByText('This video is unavailable.')).toBeVisible()
  })
})
