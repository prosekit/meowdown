import '../style.css'

import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import {
  useLightbox,
  type LightboxController,
  type LightboxImageItem,
  type LightboxVideoItem,
} from '../hooks/use-lightbox.ts'

import { LightboxImage } from './lightbox-image.tsx'
import { LightboxRoot } from './lightbox-root.tsx'
import { LightboxVideo } from './lightbox-video.tsx'

const ITEM: LightboxImageItem = {
  type: 'image',
  src: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'/%3E",
  alt: 'Cat',
}

const VIDEO: LightboxVideoItem = {
  type: 'video',
  sources: [
    { src: 'https://example.com/high.mp4', type: 'video/mp4' },
    { src: 'https://example.com/playlist.m3u8', type: 'application/x-mpegURL' },
  ],
  poster: ITEM.src,
  width: 1280,
  height: 720,
  alt: 'Launch',
}

// Stubbed so the tests can exercise both motion settings.
function installMatchMedia(reducedMotion: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    return {
      matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
      media: query,
    } as MediaQueryList
  })
}

let controller: LightboxController

function Host() {
  const lightbox = useLightbox()
  useEffect(() => {
    controller = lightbox
  })
  return (
    <LightboxRoot lightbox={lightbox}>
      {(item) => (
        <button type="button" onClick={() => lightbox.close()}>
          {item.type === 'image' ? (
            <LightboxImage item={item} style={{ opacity: 0.5 }} />
          ) : (
            <LightboxVideo item={item} style={{ opacity: 0.5 }} />
          )}
        </button>
      )}
    </LightboxRoot>
  )
}

function appendThumbnail(): HTMLImageElement {
  const thumbnail = document.createElement('img')
  thumbnail.src = ITEM.src
  thumbnail.width = 50
  thumbnail.height = 50
  document.body.append(thumbnail)
  return thumbnail
}

// Whether the browser is animating a zoom between the thumbnail and the
// lightbox image right now.
function isZooming(): boolean {
  return document.getAnimations().some((animation) => {
    const effect = animation.effect
    return (
      effect instanceof KeyframeEffect &&
      effect.pseudoElement === '::view-transition-group(meowdown-lightbox)'
    )
  })
}

const dialog = page.getByRole('dialog', { name: 'Image preview' })
const videoDialog = page.getByRole('dialog', { name: 'Video preview' })
const image = dialog.getByRole('img', { name: 'Cat' })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Lightbox', () => {
  it('zooms from the thumbnail on open and back to it on Escape', async () => {
    installMatchMedia(false)
    const thumbnail = appendThumbnail()
    await render(<Host />)

    controller.open(ITEM, thumbnail)
    await vi.waitFor(() => expect(isZooming()).toBe(true))
    await expect.element(dialog).toBeInTheDocument()
    await vi.waitFor(() => expect(isZooming()).toBe(false))
    expect(thumbnail.style.viewTransitionName).toBe('')

    await userEvent.keyboard('{Escape}')
    await vi.waitFor(() => expect(isZooming()).toBe(true))
    await expect.element(dialog).not.toBeInTheDocument()
    await vi.waitFor(() => expect(thumbnail.style.viewTransitionName).toBe(''))
    thumbnail.remove()
  })

  it('closes without a zoom when asked to close instantly', async () => {
    installMatchMedia(false)
    const thumbnail = appendThumbnail()
    await render(<Host />)

    controller.open(ITEM, thumbnail)
    await expect.element(dialog).toBeInTheDocument()
    await vi.waitFor(() => expect(isZooming()).toBe(false))

    controller.close({ instant: true })
    await expect.element(dialog).not.toBeInTheDocument()
    expect(isZooming()).toBe(false)
    expect(thumbnail.style.viewTransitionName).toBe('')
    thumbnail.remove()
  })

  it('opens and closes without a zoom under reduced motion', async () => {
    installMatchMedia(true)
    const thumbnail = appendThumbnail()
    await render(<Host />)

    controller.open(ITEM, thumbnail)
    await expect.element(dialog).toBeInTheDocument()
    expect(isZooming()).toBe(false)
    expect(thumbnail.style.viewTransitionName).toBe('')

    await userEvent.keyboard('{Escape}')
    await expect.element(dialog).not.toBeInTheDocument()
    expect(isZooming()).toBe(false)
    thumbnail.remove()
  })

  it('renders the item and keeps host styles on the image', async () => {
    installMatchMedia(true)
    await render(<Host />)

    controller.open(ITEM)
    await expect.element(image).toHaveAttribute('src', ITEM.src)
    await expect.element(image).toHaveStyle({ opacity: '0.5' })
  })

  it('renders a video item as a player that starts on open', async () => {
    installMatchMedia(true)
    await render(<Host />)

    controller.open(VIDEO)
    await expect.element(videoDialog).toBeInTheDocument()
    const video = videoDialog.element().querySelector('video')!
    expect(video.controls).toBe(true)
    expect(video.autoplay).toBe(true)
    expect(video.muted).toBe(false)
    expect(video.loop).toBe(false)
    expect(video.poster).toBe(ITEM.src)
    expect(video.getAttribute('aria-label')).toBe('Launch')
    expect(video.style.opacity).toBe('0.5')
    expect(Array.from(video.querySelectorAll('source'), (source) => source.src)).toEqual([
      'https://example.com/high.mp4',
      'https://example.com/playlist.m3u8',
    ])
  })

  it('plays a GIF item muted, looping, and without controls', async () => {
    installMatchMedia(true)
    await render(<Host />)

    controller.open({ ...VIDEO, gif: true })
    await expect.element(videoDialog).toBeInTheDocument()
    const video = videoDialog.element().querySelector('video')!
    expect(video.controls).toBe(false)
    expect(video.muted).toBe(true)
    expect(video.loop).toBe(true)
  })

  it('zooms a video from its poster element', async () => {
    installMatchMedia(false)
    const thumbnail = appendThumbnail()
    await render(<Host />)

    controller.open(VIDEO, thumbnail)
    await vi.waitFor(() => expect(isZooming()).toBe(true))
    await expect.element(videoDialog).toBeInTheDocument()
    await vi.waitFor(() => expect(isZooming()).toBe(false))

    controller.close()
    await vi.waitFor(() => expect(isZooming()).toBe(true))
    await expect.element(videoDialog).not.toBeInTheDocument()
    thumbnail.remove()
  })

  it('closes from host content', async () => {
    installMatchMedia(true)
    await render(<Host />)

    controller.open(ITEM)
    await image.click()
    await expect.element(dialog).not.toBeInTheDocument()
  })
})
