import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { getLinkUnitAt, type LinkUnit } from './get-link-unit-at.ts'

const linkTapKey = new PluginKey('meowdown-link-tap')
const TAP_MOVE_TOLERANCE = 10

interface PendingTap {
  identifier: number
  clientX: number
  clientY: number
}

export interface LinkTapPayload {
  readonly link: LinkUnit
  readonly event: TouchEvent
}

export type LinkTapHandler = (payload: LinkTapPayload) => void

function closestLink(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest('.md-link') : null
}

function findTouch(touches: TouchList, identifier: number): Touch | undefined {
  return Array.from(touches).find((touch) => touch.identifier === identifier)
}

function moved(pending: PendingTap, touch: Touch): boolean {
  return (
    Math.abs(touch.clientX - pending.clientX) > TAP_MOVE_TOLERANCE ||
    Math.abs(touch.clientY - pending.clientY) > TAP_MOVE_TOLERANCE
  )
}

function linkAtTouch(view: EditorView, touch: Touch): LinkUnit | undefined {
  const position = view.posAtCoords({ left: touch.clientX, top: touch.clientY })?.pos
  return position === undefined ? undefined : getLinkUnitAt(view.state, position)
}

/**
 * Open a link surface from a stationary, single-finger tap. Cancelling the
 * completed gesture prevents both the synthetic click and WebKit's editor
 * focus behavior, while allowing scrolls and multi-touch gestures through.
 */
export function defineLinkTapHandler(onTap: LinkTapHandler): PlainExtension {
  const pendingTaps = new WeakMap<EditorView, PendingTap>()

  return definePlugin(
    new Plugin({
      key: linkTapKey,
      props: {
        handleDOMEvents: {
          pointerdown: (_view, event) => {
            if (event.pointerType !== 'mouse' && closestLink(event.target)) {
              event.preventDefault()
            }
            return false
          },
          touchstart: (view, event) => {
            pendingTaps.delete(view)
            if (event.touches.length !== 1 || !closestLink(event.target)) return false
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
            if (!pending || event.touches.length > 1) {
              pendingTaps.delete(view)
              return false
            }
            const touch = findTouch(event.changedTouches, pending.identifier)
            if (touch && moved(pending, touch)) pendingTaps.delete(view)
            return false
          },
          touchcancel: (view) => {
            pendingTaps.delete(view)
            return false
          },
          touchend: (view, event) => {
            const pending = pendingTaps.get(view)
            pendingTaps.delete(view)
            if (!pending || event.touches.length > 0) return false
            const touch = findTouch(event.changedTouches, pending.identifier)
            if (!touch || moved(pending, touch) || !closestLink(event.target)) return false
            const link = linkAtTouch(view, touch)
            if (!link) return false
            event.preventDefault()
            onTap({ link, event })
            return true
          },
        },
      },
    }),
  )
}
