import type { ImageClickHandler, XPostMediaClickHandler } from '@meowdown/core'
import { useLightbox, type LightboxItem } from '@meowdown/react'
import type { XPostMedia } from '@post-embed/types'
import { useCallback } from 'react'

function toLightboxItem(media: XPostMedia): LightboxItem {
  if (media.type === 'photo') {
    return { type: 'image', src: media.url, alt: media.alt }
  }
  return {
    type: 'video',
    sources: media.sources.map((source) => ({ src: source.url, type: source.type })),
    poster: media.poster,
    width: media.width,
    height: media.height,
    gif: media.type === 'gif',
  }
}

/**
 * A lightbox for the demos, with the editor callbacks that open it.
 */
export function useDemoLightbox() {
  const lightbox = useLightbox()
  const open = lightbox.open

  const handleImageClick: ImageClickHandler = useCallback(
    ({ src, alt, element }) => open({ type: 'image', src, alt }, element),
    [open],
  )

  const handleXPostMediaClick: XPostMediaClickHandler = useCallback(
    (event) => {
      // Without this the card opens the photo URL or plays the video in place.
      event.preventDefault()
      open(toLightboxItem(event.detail.media), event.detail.element)
    },
    [open],
  )

  return { lightbox, handleImageClick, handleXPostMediaClick }
}
