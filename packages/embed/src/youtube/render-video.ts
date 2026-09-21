import type { YouTubeVideo } from '@post-embed/types'
import el from 'crelt'

import { isPlainClick } from '../is-plain-click.ts'
import { renderLink } from '../render-link.ts'
import { getSafeUrl } from '../safe-url.ts'

import { getEmbedUrl, getWatchUrl, type YouTubeVideoRef } from './parse-url.ts'
import { dispatchVideoClick } from './video-click.ts'

export type Playback = 'link' | 'inline'

function renderFrame(ref: YouTubeVideoRef, title: string) {
  return el('iframe', {
    src: getEmbedUrl(ref),
    title,
    allow:
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen',
    allowfullscreen: true,
    referrerpolicy: 'strict-origin-when-cross-origin',
  })
}

export function renderVideo(video: YouTubeVideo, ref: YouTubeVideoRef, playback: Playback) {
  const watchUrl = getWatchUrl(ref)
  const title = video.title || 'YouTube video'
  const poster = getSafeUrl(video.thumbnail_url)
  const external = { target: '_blank', rel: 'noopener noreferrer' }
  const image = poster
    ? el('img', {
        src: poster,
        alt: '',
        width: video.thumbnail_width || undefined,
        height: video.thumbnail_height || undefined,
        loading: 'lazy',
        decoding: 'async',
        referrerpolicy: 'no-referrer',
      })
    : undefined
  const posterContent = [image, el('span', { 'data-play': '', 'aria-hidden': 'true' })]
  const onClick = (element: HTMLElement) => {
    return dispatchVideoClick(element, { video, ...ref, embedUrl: getEmbedUrl(ref), element })
  }
  let posterElement: HTMLElement
  if (playback === 'inline') {
    const button = el(
      'button',
      { 'data-poster': '', type: 'button', 'aria-label': `Play: ${title}` },
      posterContent,
    )
    button.addEventListener('click', () => {
      if (!onClick(image ?? button)) return
      const frame = renderFrame(ref, title)
      button.replaceWith(frame)
      frame.focus()
    })
    posterElement = button
  } else {
    const link = el('a', { 'data-poster': '', href: watchUrl, ...external }, posterContent)
    // A modified click keeps the browser's own "open in new tab" behavior.
    link.addEventListener('click', (event) => {
      if (isPlainClick(event) && !onClick(image ?? link)) event.preventDefault()
    })
    posterElement = link
  }
  return el(
    'article',
    { 'data-orientation': ref.short ? 'portrait' : undefined },
    posterElement,
    el(
      'div',
      { 'data-details': '' },
      el('a', { 'data-title': '', href: watchUrl, ...external }, title),
      video.author_name
        ? renderLink(el('span', { 'data-author': '' }, video.author_name), video.author_url)
        : undefined,
    ),
  )
}
