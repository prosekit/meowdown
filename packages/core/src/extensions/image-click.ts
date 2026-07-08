import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { getMarkRangeAt } from './get-mark-range-at.ts'
import type { MdImageAttrs } from './inline-marks.ts'

const imageClickKey = new PluginKey('meowdown-image-click')

interface ImageHit {
  from: number
  to: number
  src: string
  alt: string
}

function getClosestImagePreview(target: EventTarget | null): HTMLElement | false | null {
  return target instanceof HTMLElement && target.closest('.md-image-view-preview')
}

function findImageAt(state: EditorState, pos: number): ImageHit | undefined {
  const range = getMarkRangeAt(state, pos, 'mdImage')
  if (!range) return
  const { src, alt } = range.mark.attrs as MdImageAttrs
  return { from: range.from, to: range.to, src, alt }
}

/**
 * Resolve the image hit for a preview element via its content holder, not the
 * event's document position: an event on the non-editable preview lands on the
 * run boundary, where `getMarkRange` would pick the next adjacent image.
 */
function findImageForPreview(view: EditorView, preview: HTMLElement): ImageHit | undefined {
  const content = preview.closest('.md-image-view')?.querySelector('.md-image-view-content')
  if (!content) return
  return findImageAt(view.state, view.posAtDOM(content, 0))
}

/** Payload for {@link ImageClickHandler}. */
export interface ImageClickPayload {
  /** The markdown `src`, exactly as written in `![alt](src)`. */
  src: string
  /** The image alt text. */
  alt: string
  /**
   * The originating click or touch tap. Read the target or position a popover
   * from it; a touch surface delivers the `touchend` instead of a click.
   */
  event: MouseEvent | TouchEvent
}

export type ImageClickHandler = (payload: ImageClickPayload) => void

/** A touch that might become a tap on an image preview. */
interface PendingTap {
  identifier: number
  clientX: number
  clientY: number
}

/** Fingers wander a little during a tap; past this it is a scroll or a drag. */
const TAP_MOVE_TOLERANCE = 10

function findTouch(touches: TouchList, identifier: number): Touch | undefined {
  return Array.from(touches).find((touch) => touch.identifier === identifier)
}

function isWithinTapTolerance(pending: PendingTap, touch: Touch): boolean {
  return (
    Math.abs(touch.clientX - pending.clientX) <= TAP_MOVE_TOLERANCE &&
    Math.abs(touch.clientY - pending.clientY) <= TAP_MOVE_TOLERANCE
  )
}

/**
 * Call `onClick` when the user clicks or taps a rendered image preview, with
 * the image's markdown `src`, `alt`, and the originating event.
 *
 * Touch taps are handled from `touchend` rather than the synthetic click:
 * previews live inside the editor contenteditable, and iOS WebKit's
 * tap-to-focus is a native gesture default action that only cancelling the
 * `touchend` can suppress — otherwise a tap briefly focuses the editor and
 * raises the software keyboard before the handler opens its own surface
 * (such as a lightbox).
 */
export function defineImageClickHandler(onClick: ImageClickHandler): PlainExtension {
  const pendingTaps = new WeakMap<EditorView, PendingTap>()

  const handleTouchEnd = (view: EditorView, event: TouchEvent): boolean => {
    const pending = pendingTaps.get(view)
    pendingTaps.delete(view)
    if (!pending || event.touches.length > 0) return false
    const touch = findTouch(event.changedTouches, pending.identifier)
    if (!touch || !isWithinTapTolerance(pending, touch)) return false
    const preview = getClosestImagePreview(event.target)
    if (!preview) return false
    // Cancelling the touchend also suppresses the synthetic click, so the
    // handler fires here instead of in handleClick.
    event.preventDefault()
    const hit = findImageForPreview(view, preview)
    if (hit) onClick({ src: hit.src, alt: hit.alt, event })
    return true
  }

  return definePlugin(
    new Plugin({
      key: imageClickKey,
      props: {
        handleDOMEvents: {
          pointerdown: (view, event) => {
            if (getClosestImagePreview(event.target) && event.pointerType !== 'mouse') {
              // Clickable image previews live inside the editor contenteditable. On touch surfaces,
              // tapping a rendered image can let the browser focus the editor on pointerdown before
              // the image click handler opens an external surface such as a lightbox. In mobile
              // WebKit this can briefly raise the software keyboard.
              event.preventDefault()
            }
            return false
          },
          touchstart: (view, event) => {
            pendingTaps.delete(view)
            if (event.touches.length !== 1) return false
            if (!getClosestImagePreview(event.target)) return false
            // A touch on the resize handle starts a resize, never a tap.
            if (
              event.target instanceof HTMLElement &&
              event.target.closest('.md-image-resize-handle')
            ) {
              return false
            }
            const touch = event.changedTouches[0]
            if (!touch) return false
            pendingTaps.set(view, {
              identifier: touch.identifier,
              clientX: touch.clientX,
              clientY: touch.clientY,
            })
            return false
          },
          touchmove: (view, event) => {
            const pending = pendingTaps.get(view)
            if (!pending) return false
            const touch = findTouch(event.changedTouches, pending.identifier)
            if (touch && !isWithinTapTolerance(pending, touch)) pendingTaps.delete(view)
            return false
          },
          touchcancel: (view) => {
            pendingTaps.delete(view)
            return false
          },
          touchend: handleTouchEnd,
        },
        handleClick: (view, _pos, event) => {
          const preview = getClosestImagePreview(event.target)
          if (!preview) return false
          const hit = findImageForPreview(view, preview)
          if (!hit) return false
          onClick({ src: hit.src, alt: hit.alt, event })
          return true
        },
      },
    }),
  )
}
