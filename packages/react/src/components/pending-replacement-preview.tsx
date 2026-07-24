import { Popover } from '@base-ui/react/popover'
import {
  definePendingReplacementHandler,
  getPendingReplacement,
  getVirtualElementFromRange,
  type EditorExtension,
  type PendingReplacement,
  type VirtualElement,
} from '@meowdown/core'
import { useEditor, useExtension } from '@prosekit/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import styles from './pending-replacement-preview.module.css'
import type { PendingReplacementResolveHandler } from './types.ts'

/**
 * Vertical room (px) the popover needs under its anchor: the text area's
 * 14rem max-height plus the footer, borders, and the anchor offset.
 */
const PREVIEW_CLEARANCE = 320

/** Minimum gap (px) kept above the anchor line when scrolling to make room. */
const SCROLL_TOP_MARGIN = 16

/** The nearest ancestor that can scroll vertically, or the page scroller. */
function closestScrollable(element: Element): Element | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node
    }
  }
  return document.scrollingElement
}

interface PendingReplacementPreviewProps {
  /** Extra controls rendered in the preview footer (e.g. a retry button). */
  actions?: ReactNode
  /** Called when the stage ends, with the outcome and the final staged value. */
  onResolve?: PendingReplacementResolveHandler
}

/**
 * The preview for a staged (pending) replacement: a popover anchored to the
 * end of the source range showing the accumulated text, with a Discard control
 * and an accept control labeled by what accepting does ("Replace selection" or
 * "Insert below", per the staged mode), plus a host-provided `actions` slot.
 * Dismissing the popover (Escape or an outside press) discards the stage; the
 * document is only touched on accept.
 */
export function PendingReplacementPreview({
  actions,
  onResolve,
}: PendingReplacementPreviewProps): ReactNode {
  const editor = useEditor<EditorExtension>()
  const [pending, setPending] = useState<PendingReplacement | null>(null)

  useExtension(
    useMemo(() => {
      return definePendingReplacementHandler((event) => {
        if (event.type === 'update') {
          setPending(event.pending)
        } else {
          setPending(null)
          onResolve?.(event.outcome, event.pending)
        }
      })
    }, [onResolve]),
  )

  // Anchored to the end of the staged range, not its bounding box: a range
  // taller than the viewport leaves no room on either side of its box, letting
  // collision handling fling the popover to the top of the viewport, far from
  // the text it previews. The end caret keeps it by the last line.
  const to = pending?.to
  const anchor: VirtualElement | undefined = useMemo(() => {
    if (to == null) return
    return getVirtualElementFromRange(editor.view, { from: to, to })
  }, [to, editor])

  // When a stage starts, make room for the preview: with the anchor scrolled
  // out of view (a selection taller than the viewport) the popover would open
  // where the user cannot see it, and with the anchor near the viewport bottom
  // the popover would flip up over the very text it replaces. The anchor line
  // is scrolled to where the popover fits below it. Keyed on whether a stage
  // exists, not its value: streamed text and range remaps must not re-scroll,
  // and a retry restages without ending, so it stays put too.
  const staged = pending !== null
  useEffect(() => {
    if (!staged) return
    const view = editor.view
    const position = getPendingReplacement(view.state)?.to
    if (position == null) return
    const clearanceBottom = window.innerHeight - PREVIEW_CLEARANCE
    let coords = view.coordsAtPos(position)
    if (coords.top >= 0 && coords.bottom <= clearanceBottom) return
    const { node } = view.domAtPos(position)
    const element = node instanceof Element ? node : node.parentElement
    if (!element) return
    element.scrollIntoView({ block: 'center' })
    // Centering may still leave too little room in a short viewport; nudge the
    // nearest scroller the rest of the way, without pushing the line off-top.
    coords = view.coordsAtPos(position)
    const overflow = coords.bottom - clearanceBottom
    const nudge = Math.min(overflow, Math.max(0, coords.top - SCROLL_TOP_MARGIN))
    if (nudge > 0) {
      const scroller = closestScrollable(element)
      if (scroller) scroller.scrollTop += nudge
    }
  }, [staged, editor])

  if (!pending) return null

  const discard = (): void => {
    editor.commands.discardPendingReplacement()
    editor.focus()
  }
  const accept = (): void => {
    editor.commands.acceptPendingReplacement()
    editor.focus()
  }

  return (
    <Popover.Root
      open
      onOpenChange={(next) => {
        if (!next) discard()
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side="bottom"
          sideOffset={8}
          className={styles.Positioner}
        >
          <Popover.Popup
            className={styles.Popup}
            data-testid="pending-replacement"
            initialFocus={false}
            finalFocus={false}
          >
            <div className={styles.Text} data-testid="pending-replacement-text">
              {pending.text || <span className={styles.Waiting}>Waiting for text...</span>}
            </div>
            <div className={styles.Footer}>
              {actions}
              <span className={styles.Spacer} />
              <button
                type="button"
                className={styles.Button}
                data-testid="pending-replacement-discard"
                onClick={discard}
              >
                Discard
              </button>
              <button
                type="button"
                className={styles.AcceptButton}
                data-testid="pending-replacement-accept"
                disabled={!pending.text.trim()}
                onClick={accept}
              >
                {pending.mode === 'replace' ? 'Replace selection' : 'Insert below'}
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
