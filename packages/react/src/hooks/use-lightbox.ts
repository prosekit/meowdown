import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

/**
 * The `view-transition-name` shared by the opened thumbnail and the lightbox
 * content, so the browser zooms between them.
 */
export const LIGHTBOX_TRANSITION_NAME = 'meowdown-lightbox'

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
  // FIXME: what's poster? is it a URL? make the doc clearer.
  poster?: string | undefined
  /**
   * Intrinsic size, so the player has its final box before metadata loads.
   * FIXME: the size in which unit? make the doc clearer.
   */
  width?: number | undefined
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
   * Show `item`, zooming from `element` (usually the clicked thumbnail) when
   * the browser supports View Transitions.
   *
   * FIXME:
   */
  readonly open: (item: LightboxItem, element?: HTMLElement | null) => void
  readonly close: (options?: LightboxCloseOptions) => void
}

// FIXME: move this function to packages/react/src/utils and also wrap it with try catch (error) {console.warn}
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
    if (prefersReducedMotion()) {
      setItem(nextItem)
      return
    }
    setTransitionName(sourceRef.current, LIGHTBOX_TRANSITION_NAME)
    startTransition(() => setItem(nextItem))
  }, [])

  const close = useCallback((options?: LightboxCloseOptions) => {
    instantRef.current = options?.instant === true || prefersReducedMotion()
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

  // React holds passive effects back until the View Transition has finished,
  // so this runs once the zoom back to the thumbnail is over.
  useEffect(() => {
    if (isOpen) return
    setTransitionName(sourceRef.current, '')
    sourceRef.current = null
  }, [isOpen])

  return useMemo(() => ({ item, open, close }), [item, open, close])
}
