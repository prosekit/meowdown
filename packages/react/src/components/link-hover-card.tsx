import {
  type EditorExtension,
  linkAt,
  type LinkHit,
  wikilinkAt,
  type WikilinkHit,
} from '@meowdown/core'
import { defineDOMEventHandler, union } from '@prosekit/core'
import { TextSelection } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'
import { useEditor, useExtension } from '@prosekit/react'
import {
  InlinePopoverPopup,
  InlinePopoverPositioner,
  InlinePopoverRoot,
} from '@prosekit/react/inline-popover'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { LinkCardDefault } from './link-card-default.tsx'
import styles from './link-hover-card.module.css'
import type {
  LinkClickHandler,
  LinkHoverHandler,
  WikilinkClickHandler,
  WikilinkHoverHandler,
} from './types.ts'

/** Pointer dwell before the card opens, in milliseconds. */
const DWELL_MS = 350
/** Grace period after the pointer leaves before the card closes, in milliseconds. */
const CLOSE_GRACE_MS = 200

type Hovered =
  | { kind: 'link'; element: Element; hit: LinkHit }
  | { kind: 'wikilink'; element: Element; hit: WikilinkHit }

export interface LinkHoverCardProps {
  onLinkHover?: LinkHoverHandler
  onWikilinkHover?: WikilinkHoverHandler
  onLinkClick?: LinkClickHandler
  onWikilinkClick?: WikilinkClickHandler
}

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

export function LinkHoverCard({
  onLinkHover,
  onWikilinkHover,
  onLinkClick,
  onWikilinkClick,
}: LinkHoverCardProps) {
  const editor = useEditor<EditorExtension>()

  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<Element | null>(null)
  const [content, setContent] = useState<ReactNode>(null)

  const openRef = useRef(false)
  const currentElementRef = useRef<Element | null>(null)
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const abortRef = useRef<AbortController | null>(null)

  const linkEnabled = !!(onLinkHover || onLinkClick)
  const wikilinkEnabled = !!(onWikilinkHover || onWikilinkClick)

  // Hover detection runs through stable extension handlers that always call the
  // latest closure via these refs, so they see the current props.
  const onMoveRef = useRef<(view: EditorView, event: PointerEvent) => void>(() => {})
  const onLeaveRef = useRef<() => void>(() => {})
  const onDownRef = useRef<() => void>(() => {})

  const cancelClose = () => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }
  }

  const closeCard = () => {
    openRef.current = false
    currentElementRef.current = null
    abortRef.current?.abort()
    abortRef.current = null
    setOpen(false)
  }

  const scheduleCloseIfOpen = () => {
    currentElementRef.current = null
    if (dwellTimerRef.current != null) {
      clearTimeout(dwellTimerRef.current)
      dwellTimerRef.current = undefined
    }
    if (openRef.current && closeTimerRef.current == null) {
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = undefined
        closeCard()
      }, CLOSE_GRACE_MS)
    }
  }

  const placeCaret = (hit: LinkHit | WikilinkHit) => {
    const { view } = editor
    const pos = Math.min(hit.to, view.state.doc.content.size)
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)).scrollIntoView(),
    )
    view.focus()
  }

  const renderDefault = (hovered: Hovered): ReactNode => {
    const onEdit = () => {
      placeCaret(hovered.hit)
      closeCard()
    }
    if (hovered.kind === 'link') {
      const { href } = hovered.hit
      return (
        <LinkCardDefault
          kind="link"
          href={href}
          onEdit={onEdit}
          onCopy={() => void navigator.clipboard?.writeText(href)}
          onOpen={(event) => {
            closeCard()
            if (onLinkClick) {
              onLinkClick({ ...hovered.hit, event: event.nativeEvent })
            } else {
              window.open(href, '_blank', 'noopener')
            }
          }}
        />
      )
    }
    return (
      <LinkCardDefault
        kind="wikilink"
        onEdit={onEdit}
        onOpen={
          onWikilinkClick
            ? (event) => {
                closeCard()
                onWikilinkClick({ ...hovered.hit, event: event.nativeEvent })
              }
            : undefined
        }
      />
    )
  }

  const openCard = (hovered: Hovered) => {
    cancelClose()
    setAnchor(hovered.element)
    setOpen(true)
    openRef.current = true

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const result =
      hovered.kind === 'wikilink'
        ? onWikilinkHover?.({ ...hovered.hit, signal: controller.signal })
        : onLinkHover?.({ ...hovered.hit, signal: controller.signal })

    if (result === false) {
      closeCard()
      return
    }
    if (result == null) {
      setContent(renderDefault(hovered))
      return
    }
    if (isPromise(result)) {
      setContent(<div className={styles.Loading}>Loading...</div>)
      result.then(
        (node) => {
          if (controller.signal.aborted) return
          setContent(node == null ? renderDefault(hovered) : node)
        },
        () => {
          if (!controller.signal.aborted) setContent(renderDefault(hovered))
        },
      )
      return
    }
    setContent(result)
  }

  onMoveRef.current = (view, event) => {
    if (!view.hasFocus()) return
    const target = event.target as Element | null
    if (!target || target.closest('pre, code')) {
      scheduleCloseIfOpen()
      return
    }
    const wikiEl = wikilinkEnabled ? target.closest('.md-wikilink') : null
    const linkEl = !wikiEl && linkEnabled ? target.closest('a') : null
    const element = wikiEl ?? linkEl
    if (!element) {
      scheduleCloseIfOpen()
      return
    }
    cancelClose()
    if (element === currentElementRef.current) return

    const at = view.posAtCoords({ left: event.clientX, top: event.clientY })
    let hovered: Hovered | null = null
    if (at && wikiEl) {
      const hit = wikilinkAt(view.state, at.pos)
      if (hit) hovered = { kind: 'wikilink', element: wikiEl, hit }
    } else if (at && linkEl) {
      const hit = linkAt(view.state, at.pos)
      if (hit) hovered = { kind: 'link', element: linkEl, hit }
    }
    if (!hovered) {
      scheduleCloseIfOpen()
      return
    }

    currentElementRef.current = element
    if (dwellTimerRef.current != null) clearTimeout(dwellTimerRef.current)
    if (openRef.current) {
      openCard(hovered)
    } else {
      const next = hovered
      dwellTimerRef.current = setTimeout(() => {
        dwellTimerRef.current = undefined
        openCard(next)
      }, DWELL_MS)
    }
  }

  onLeaveRef.current = () => scheduleCloseIfOpen()
  onDownRef.current = () => closeCard()

  const extension = useMemo(
    () =>
      union(
        defineDOMEventHandler('pointermove', (view, event) => {
          onMoveRef.current(view, event)
          return false
        }),
        defineDOMEventHandler('pointerleave', () => {
          onLeaveRef.current()
          return false
        }),
        defineDOMEventHandler('pointerdown', () => {
          onDownRef.current()
          return false
        }),
      ),
    [],
  )
  useExtension(extension)

  useEffect(() => {
    return () => {
      if (dwellTimerRef.current != null) clearTimeout(dwellTimerRef.current)
      if (closeTimerRef.current != null) clearTimeout(closeTimerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  return (
    <InlinePopoverRoot
      defaultOpen={false}
      anchor={anchor}
      open={open}
      onOpenChange={(event) => setOpen(event.detail)}
    >
      <InlinePopoverPositioner className={styles.Positioner} placement="top">
        <InlinePopoverPopup
          className={styles.Popup}
          data-testid="link-hover-card"
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleCloseIfOpen}
        >
          {content}
        </InlinePopoverPopup>
      </InlinePopoverPositioner>
    </InlinePopoverRoot>
  )
}
