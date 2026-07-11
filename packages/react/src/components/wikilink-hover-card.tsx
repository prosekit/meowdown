import { Popover } from '@base-ui/react/popover'
import { defineWikilinkHoverHandler, type WikilinkHoverHit } from '@meowdown/core'
import { useExtension } from '@prosekit/react'
import { clsx } from 'clsx/lite'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import styles from './wikilink-hover-card.module.css'

const OPEN_DELAY = 300

interface HoverRequest extends WikilinkHoverHit {
  readonly id: number
}

/** Values passed to a wiki-link hover card's host renderer. */
export interface WikilinkHoverCardRenderContext {
  /** The wiki-link target exactly as parsed from the Markdown source. */
  readonly target: string
  /**
   * Close this request's card. Calls retained by an older request are ignored,
   * so stale asynchronous work cannot dismiss a newer target.
   */
  readonly dismiss: () => void
}

/** Props for {@link WikilinkHoverCard}. */
export interface WikilinkHoverCardProps {
  /**
   * Render the host-owned card body. The body is inert and pointer-transparent;
   * use `dismiss` when the target cannot produce preview content.
   */
  readonly children: (context: WikilinkHoverCardRenderContext) => ReactNode
  /** Optional class applied to the passive popup container. */
  readonly className?: string
}

/**
 * Show host-rendered content after a 300ms dwell over a rendered wiki link.
 *
 * Mount this component as a child of `MeowdownEditor`, where it can access the
 * existing ProseKit context. Moving to another target restarts the dwell;
 * leaving closes immediately. The popup portals to the document, anchors to
 * the visible label element, flips and shifts within an 8px collision margin,
 * and never takes focus or pointer input.
 */
export function WikilinkHoverCard({ children, className }: WikilinkHoverCardProps): ReactNode {
  const requestIdRef = useRef(0)
  const [request, setRequest] = useState<HoverRequest>()
  const [visibleRequestId, setVisibleRequestId] = useState<number>()

  const [hoverExtension] = useState(() => {
    return defineWikilinkHoverHandler((hit) => {
      requestIdRef.current += 1
      setRequest(hit ? { ...hit, id: requestIdRef.current } : undefined)
    })
  })
  useExtension(hoverExtension)

  useEffect(() => {
    if (!request) return
    const timer = setTimeout(() => setVisibleRequestId(request.id), OPEN_DELAY)
    return () => clearTimeout(timer)
  }, [request])

  const requestId = request?.id
  const dismiss = useCallback(() => {
    if (requestId == null) return
    setRequest((current) => (current?.id === requestId ? undefined : current))
  }, [requestId])

  if (!request || visibleRequestId !== request.id) return null

  return (
    <Popover.Root
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) dismiss()
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
            {children({ target: request.target, dismiss })}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
