import './theme.css'

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

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
    expect(videos[0].querySelector('source')?.src).toContain('motion.mp4')
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
    snapshot.media = [
      { ...createPhoto(), url: new URL('./testing/missing.jpg', import.meta.url).href },
    ]
    element.data = { ...snapshot }
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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const snapshot = createPost()
    snapshot.media = [
      createPhoto(),
      {
        ...createVideo(),
        sources: [
          {
            type: 'video/mp4',
            url: new URL('./testing/missing.mp4?token=secret#private', import.meta.url).href,
          },
        ],
      },
    ]
    const element = mount(snapshot)
    expect(element.querySelectorAll('[data-media-item]')).toHaveLength(2)
    await post.getByRole('button', { name: 'Play video' }).click()
    await expect
      .element(post.getByText('Media could not be loaded.', { exact: false }).nth(1))
      .toBeVisible()
    expect(element.querySelector('video')?.hidden).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/token=secret|#private/)
  })

  it('plays a later source after an earlier source fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const snapshot = createPost()
    const media = createVideo()
    media.sources.unshift({
      type: 'video/mp4',
      bitrate: 1000,
      url: new URL('./testing/missing.mp4', import.meta.url).href,
    })
    snapshot.media = [media]
    mount(snapshot)
    await post.getByRole('button', { name: 'Play video' }).click()
    const player = post.getByLabelText('Post video')
    await expect.poll(() => (player.element() as HTMLVideoElement).currentTime).toBeGreaterThan(0)
    await expect.element(player).toBeVisible()
    expect(warn).not.toHaveBeenCalled()
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
      sources: [
        { url: expect.stringContaining('motion.mp4') as string, bitrate: 200 },
        { bitrate: 100 },
        { type: 'application/x-mpegURL' },
      ],
    })
  })
})
