import type { XPostMedia } from '@post-embed/types'
import el from 'crelt'

import { renderLink } from '../render-link.ts'
import { getSafeUrl } from '../safe-url.ts'

import { dispatchMediaClick } from './media-click.ts'

type Photo = Extract<XPostMedia, { type: 'photo' }>
type Video = Extract<XPostMedia, { type: 'video' | 'gif' }>

function dimension(value: number): number | undefined {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined
}

function sizeAttrs(media: { width: number; height: number }) {
  const width = dimension(media.width)
  const height = dimension(media.height)
  return {
    width,
    height,
    style: width && height ? `--_ratio: ${width} / ${height}` : undefined,
  }
}

function getOrientation(media: { width: number; height: number }) {
  const width = dimension(media.width)
  const height = dimension(media.height)
  if (!width || !height) return
  return height > width * 1.1 ? 'portrait' : width > height * 1.1 ? 'landscape' : 'square'
}

/**
 * The item with only the URLs the card may load, or nothing when it has none
 * left to show.
 */
function getDisplayable(
  media: XPostMedia,
  protocols: readonly string[] | null,
): XPostMedia | undefined {
  if (media.unavailable) return
  if (media.type === 'photo') {
    const url = getSafeUrl(media.url, protocols)
    return url ? { ...media, url } : undefined
  }
  const sources = media.sources
    .flatMap((source) => {
      const url = getSafeUrl(source.url, protocols)
      return url ? [{ ...source, url }] : []
    })
    // FIXME: extra the sorting logic into a separate function and test it with unit tests and describe its behavior
    .sort((a, b) => {
      return (
        Number(b.type === 'video/mp4') - Number(a.type === 'video/mp4') ||
        (b.bitrate || 0) - (a.bitrate || 0)
      )
    })
  if (sources.length === 0) return
  const poster = media.poster && getSafeUrl(media.poster, protocols)
  return { ...media, sources, poster }
}

function renderUnavailable(permalink?: string) {
  return el(
    'div',
    { 'data-media-unavailable': '' },
    'Media unavailable. ',
    renderLink('View on X', permalink),
  )
}

function renderError(permalink?: string) {
  return el(
    'div',
    { 'data-media-error': '', hidden: true },
    'Media could not be loaded. ',
    renderLink('View on X', permalink),
  )
}

function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

function renderPhoto(media: Photo, error: HTMLElement, onClick: (element: HTMLElement) => boolean) {
  const image = el('img', {
    src: media.url,
    alt: media.alt || 'Post image',
    ...sizeAttrs(media),
    loading: 'lazy',
    decoding: 'async',
    referrerpolicy: 'no-referrer',
  })
  const link = el('a', { href: media.url, target: '_blank', rel: 'noopener noreferrer' }, image)
  image.addEventListener('error', () => {
    link.hidden = true
    error.hidden = false
  })
  // A modified click keeps the browser's own "open in new tab" behavior.
  link.addEventListener('click', (event) => {
    if (isPlainClick(event) && !onClick(image)) event.preventDefault()
  })
  return link
}

function renderPlayer(media: Video, error: HTMLElement, permalink?: string) {
  const gif = media.type === 'gif'
  const sources = media.sources.map((source) => {
    return el('source', { src: source.url, type: source.type })
  })
  const video = el(
    'video',
    {
      controls: true,
      playsInline: true,
      'aria-label': gif ? 'Animated GIF' : 'Post video',
      poster: media.poster,
      ...sizeAttrs(media),
      loop: gif,
    },
    sources,
    renderLink('Watch on X', permalink),
  )
  video.muted = gif
  const showError = () => {
    video.hidden = true
    error.hidden = false
  }
  video.addEventListener('error', showError)
  let failedSources = 0
  for (const source of sources) {
    source.addEventListener(
      'error',
      () => {
        failedSources++
        if (failedSources === sources.length) showError()
      },
      { once: true },
    )
  }
  return video
}

/**
 * A poster button. Its click plays the video in place, unless a
 * `meowdown-embed-media-click` listener takes over.
 */
function renderVideo(
  media: Video,
  error: HTMLElement,
  onClick: (element: HTMLElement) => boolean,
  permalink?: string,
) {
  const gif = media.type === 'gif'
  const poster = media.poster
    ? el('img', {
        src: media.poster,
        alt: '',
        ...sizeAttrs(media),
        loading: 'lazy',
        decoding: 'async',
        referrerpolicy: 'no-referrer',
      })
    : undefined
  const button = el(
    'button',
    {
      'data-poster': '',
      type: 'button',
      'aria-label': gif ? 'Play GIF' : 'Play video',
      style: sizeAttrs(media).style,
    },
    poster,
    el('span', { 'data-play': '', 'aria-hidden': 'true' }),
  )
  button.addEventListener('click', () => {
    if (!onClick(poster ?? button)) return
    const video = renderPlayer(media, error, permalink)
    button.replaceWith(video)
    video.focus()
    // The click is the user gesture that allows playback with sound.
    video.play().catch(() => {})
  })
  return button
}

export function renderMedia(
  media: XPostMedia[] | undefined,
  protocols: readonly string[] | null,
  permalink?: string,
) {
  if (!media?.length) return
  const displayable = media.map((item) => getDisplayable(item, protocols))
  const items = displayable.filter((item) => item != null)
  return el(
    'div',
    { 'data-media': '', 'data-count': String(media.length) },
    displayable.map((item) => {
      if (!item) return renderUnavailable(permalink)
      const error = renderError(permalink)
      const onClick = (element: HTMLElement) => {
        return dispatchMediaClick(element, {
          media: item,
          items,
          index: items.indexOf(item),
          element,
          permalink,
        })
      }
      return el(
        'div',
        {
          'data-media-item': '',
          'data-type': item.type,
          'data-orientation': getOrientation(item),
        },
        item.type === 'photo'
          ? renderPhoto(item, error, onClick)
          : renderVideo(item, error, onClick, permalink),
        error,
      )
    }),
  )
}
