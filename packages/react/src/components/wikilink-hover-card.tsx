import { PreviewCard } from '@base-ui/react/preview-card'
import {
  defineWikilinkHoverHandler,
  type VirtualElement,
  type WikilinkHoverHit,
} from '@meowdown/core'
import { useExtension } from '@prosekit/react'
import { clsx } from 'clsx/lite'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import styles from './wikilink-hover-card.module.css'

const OPEN_DELAY = 300
const CLOSE_DELAY = 200

/** Props for {@link WikilinkHoverCard}. */
export interface WikilinkHoverCardProps {
  /**
   * Render the card body from the hovered wiki link. Returning `null` renders
   * no card.
   */
  readonly children: (hit: WikilinkHoverHit) => ReactNode
  /** Optional class applied to the popup, after the default card surface. */
  readonly className?: string
}

/**
 * Show host-rendered content after a 300ms dwell over a rendered wiki link.
 */
export function WikilinkHoverCard({ children, className }: WikilinkHoverCardProps): ReactNode {
  const [hit, setHit] = useState<WikilinkHoverHit>()
  const lastRectRef = useRef<DOMRect>(null)
  const [displayed, setDisplayed] = useState<WikilinkHoverHit>()
  const [open, setOpen] = useState(false)

  const [hoverExtension] = useState(() => {
    return defineWikilinkHoverHandler((nextHit) => setHit(nextHit))
  })
  useExtension(hoverExtension)

  const getRect = useCallback((): DOMRect => {
    const rect = hit?.element?.getBoundingClientRect()
    if (rect && rect.width > 0 && rect.height > 0) {
      lastRectRef.current = rect
    }
    return lastRectRef.current || new DOMRect(0, 0, 0, 0)
  }, [hit])

  const anchor = useMemo((): VirtualElement => {
    return { getBoundingClientRect: getRect }
  }, [getRect])

  const hasDisplayed = !!displayed

  useEffect(() => {
    if (!hit) {
      const timer = setTimeout(() => setOpen(false), CLOSE_DELAY)
      return () => clearTimeout(timer)
    }

    // An already-open card moves to the next link without a new dwell.
    const openDelay = hasDisplayed ? 0 : OPEN_DELAY
    const timer = setTimeout(() => {
      setDisplayed(hit)
      setOpen(true)
    }, openDelay)
    return () => clearTimeout(timer)
  }, [hit, hasDisplayed])

  const body = displayed ? children(displayed) : null

  return (
    <PreviewCard.Root
      open={open && body != null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setOpen(false)
      }}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) setDisplayed(undefined)
      }}
    >
      {body != null && (
        <PreviewCard.Portal>
          <PreviewCard.Positioner
            anchor={anchor}
            side="bottom"
            sideOffset={8}
            collisionPadding={8}
            className={styles.Positioner}
            data-testid="wikilink-hover-positioner"
          >
            <PreviewCard.Popup
              inert
              className={clsx(styles.Popup, className)}
              data-testid="wikilink-hover-card"
            >
              <PreviewCard.Viewport className={styles.Viewport}>{body}</PreviewCard.Viewport>
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      )}
    </PreviewCard.Root>
  )
}
