import { startTransition, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

/**
 * The `view-transition-name` shared by the opened thumbnail and the lightbox
 * content, so the browser zooms between them.
 */
export const LIGHTBOX_TRANSITION_NAME = 'meowdown-lightbox-media'

/**
 * Something a lightbox can show.
 */
export type LightboxItem = LightboxImageItem | LightboxVideoItem

export interface LightboxImageItem {
  type: 'image'
  /**
   * A URL the browser can load, already resolved from the Markdown `src`.
   */
  src: string
  alt?: string | undefined
}

export interface LightboxVideoItem {
  type: 'video'
  /**
   * In the order the browser should try them.
   */
  sources: Array<{ src: string; type?: string | undefined }>
  /**
   * URL of the image the player shows until the first video frame is ready.
   */
  poster?: string | undefined
  /**
   * Width of the video itself, in pixels (not the size it is displayed at).
   * With `height` it gives the player its aspect ratio before the video's
   * metadata loads, so the open zoom ends on the right box.
   */
  width?: number | undefined
  /**
   * Height of the video itself, in pixels.
   */
  height?: number | undefined
  /**
   * Play like a GIF: muted, looping, without controls.
   */
  gif?: boolean | undefined
  alt?: string | undefined
}

export interface LightboxCloseOptions {
  /**
   * Close without the zoom back to the thumbnail, for example after the
   * content was dragged off screen.
   */
  instant?: boolean | undefined
}

/**
 * State and commands for a {@link LightboxRoot}, from {@link useLightbox}.
 */
export interface LightboxController {
  readonly item: LightboxItem | null
  /**
   * Show `item`. Pass the clicked thumbnail as `element` to zoom the lightbox
   * out of it, and back into it on close. The element only has to be in the
   * document; React does not need to render it. Without an element, in a
   * browser without View Transitions, or under reduced motion, the lightbox
   * opens and closes without the zoom.
   */
  readonly open: (item: LightboxItem, element?: HTMLElement | null) => void
  readonly close: (options?: LightboxCloseOptions) => void
  /**
   * The zoom back to the thumbnail is over.
   *
   * @internal
   */
  readonly onExited: () => void
}

function setTransitionName(element: HTMLElement | null, name: string): void {
  if (element) element.style.viewTransitionName = name
}

/**
 * Owns which item a {@link LightboxRoot} shows. Opening and closing run as
 * React transitions, so the `<ViewTransition>` inside the root animates them.
 *
 * The thumbnail is not rendered by this hook's component (it may not be
 * rendered by React at all), so its half of the shared transition is set by
 * hand: it carries the name while the browser captures the page without the
 * lightbox, and loses it while the lightbox is mounted.
 */
export function useLightbox(): LightboxController {
  const [item, setItem] = useState<LightboxItem | null>(null)
  const sourceRef = useRef<HTMLElement | null>(null)
  const instantRef = useRef(false)

  const open = useCallback((nextItem: LightboxItem, element?: HTMLElement | null) => {
    setTransitionName(sourceRef.current, '')
    sourceRef.current = element ?? null
    setTransitionName(sourceRef.current, LIGHTBOX_TRANSITION_NAME)
    startTransition(() => setItem(nextItem))
  }, [])

  const close = useCallback((options?: LightboxCloseOptions) => {
    instantRef.current = options?.instant === true
    if (instantRef.current) {
      setItem(null)
    } else {
      startTransition(() => setItem(null))
    }
  }, [])

  // Layout effects run after React mutated the DOM and before the browser
  // captures the new page, which is when the name has to change sides.
  const isOpen = item != null
  useLayoutEffect(() => {
    if (!isOpen) return
    setTransitionName(sourceRef.current, '')
    return () => {
      const source = sourceRef.current
      if (!instantRef.current && source?.isConnected) {
        setTransitionName(source, LIGHTBOX_TRANSITION_NAME)
      } else {
        sourceRef.current = null
      }
    }
  }, [isOpen])

  const onExited = useCallback(() => {
    setTransitionName(sourceRef.current, '')
    sourceRef.current = null
  }, [])

  return useMemo(() => ({ item, open, close, onExited }), [item, open, close, onExited])
}
