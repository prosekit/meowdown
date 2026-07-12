import { Popover } from '@base-ui/react/popover'
import { defineWikilinkHoverHandler, type WikilinkHoverHit } from '@meowdown/core'
import { useExtension } from '@prosekit/react'
import { clsx } from 'clsx/lite'
import { useEffect, useState, type ReactNode } from 'react'

import styles from './wikilink-hover-card.module.css'

const OPEN_DELAY = 300

/** Props for {@link WikilinkHoverCard}. */
export interface WikilinkHoverCardProps {
  /**
   * Render the card body from the hovered wiki-link target. Returning `null`
   * renders no card, so a host declines a target it has no preview for; when
   * the lookup is asynchronous, render fallback content instead.
   */
  readonly children: (target: string) => ReactNode
  /** Optional class applied to the popup, after the default card surface. */
  readonly className?: string
}

/**
 * Show host-rendered content after a 300ms dwell over a rendered wiki link.
 *
 * Mount this component as a child of `MeowdownEditor`, where it can access the
 * existing ProseKit context. Moving to another target restarts the dwell;
 * leaving closes immediately, as does deleting or rewriting the hovered link.
 * The popup portals to the document, anchors to the visible label element,
 * flips and shifts within an 8px collision margin, and never takes focus or
 * pointer input.
 */
export function WikilinkHoverCard({ children, className }: WikilinkHoverCardProps): ReactNode {
  const [request, setRequest] = useState<WikilinkHoverHit>()
  const [visibleRequest, setVisibleRequest] = useState<WikilinkHoverHit>()

  const [hoverExtension] = useState(() => {
    return defineWikilinkHoverHandler((hit) => setRequest(hit))
  })
  useExtension(hoverExtension)

  useEffect(() => {
    if (!request) return
    const timer = setTimeout(() => setVisibleRequest(request), OPEN_DELAY)
    return () => clearTimeout(timer)
  }, [request])

  if (!request || visibleRequest !== request) return null

  const body = children(request.target)
  if (body == null) return null

  return (
    <Popover.Root
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) setRequest(undefined)
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={request.element}
          side="bottom"
          sideOffset={8}
          collisionPadding={8}
          collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }}
          className={styles.Positioner}
          data-testid="wikilink-hover-positioner"
        >
          <Popover.Popup
            inert
            initialFocus={false}
            finalFocus={false}
            className={clsx(styles.Popup, className)}
            data-testid="wikilink-hover-card"
          >
            {body}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
