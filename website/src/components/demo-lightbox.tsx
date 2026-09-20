import type { ImageClickHandler, XPostMediaClickHandler } from '@meowdown/core'
import {
  LightboxImage,
  LightboxRoot,
  LightboxVideo,
  useLightbox,
  type LightboxController,
} from '@meowdown/react'
import { useCallback } from 'react'

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
      const { media, element } = event.detail
      // Without this the card opens the photo URL or plays the video in place.
      event.preventDefault()
      if (media.type === 'photo') {
        open({ type: 'image', src: media.url, alt: media.alt }, element)
        return
      }
      open(
        {
          type: 'video',
          sources: media.sources.map((source) => ({ src: source.url, type: source.type })),
          poster: media.poster,
          width: media.width,
          height: media.height,
          gif: media.type === 'gif',
        },
        element,
      )
    },
    [open],
  )

  return { lightbox, handleImageClick, handleXPostMediaClick }
}

export function DemoLightbox({ lightbox }: { lightbox: LightboxController }) {
  return (
    <LightboxRoot lightbox={lightbox}>
      {(item) => {
        return item.type === 'image' ? (
          <button
            type="button"
            aria-label="Close image preview"
            className="absolute inset-0 flex cursor-zoom-out items-center justify-center border-0 bg-transparent p-[inherit]"
            onClick={() => lightbox.close()}
          >
            <LightboxImage item={item} />
          </button>
        ) : (
          // A click on the dimmed area around the player closes; one on the
          // player itself reaches its controls.
          <div
            className="absolute inset-0 flex items-center justify-center p-[inherit]"
            onClick={(event) => {
              if (event.target === event.currentTarget) lightbox.close()
            }}
          >
            <LightboxVideo item={item} />
            <button
              type="button"
              aria-label="Close"
              className="absolute top-4 right-4 flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-white/15 text-white backdrop-blur-xl hover:bg-white/25"
              onClick={() => lightbox.close()}
            >
              <span className="i-lucide-x size-5" />
            </button>
          </div>
        )
      }}
    </LightboxRoot>
  )
}
