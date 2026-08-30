import { isElementLike } from '@ocavue/utils'
import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, type EditorState, type PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

export interface MarkHoverHit<Payload> {
  payload: Payload
  element: HTMLElement
}

export interface MarkHoverConfig<Payload> {
  key: PluginKey
  /**
   * The hovered target must sit inside this selector, tested via `closest`.
   */
  selector: string
  /**
   * The payload for the mark covering `pos`, or `undefined` on a miss.
   */
  findPayloadAt: (state: EditorState, pos: number) => Payload | undefined
  /**
   * Resolve a hit from its rendered element. Atom mark views should use their
   * hidden content holder rather than the event coordinates, which can land on
   * an adjacent mark's document boundary.
   */
  findPayloadForElement?: (view: EditorView, element: HTMLElement) => Payload | undefined
  /**
   * Whether a transaction left the hovered mark semantically unchanged.
   */
  isSamePayload: (previous: Payload, next: Payload) => boolean
  /**
   * Fired with the hit on enter, and with `undefined` on leave.
   */
  onHoverChange: (hit: MarkHoverHit<Payload> | undefined) => void
  /**
   * Milliseconds a cold pointer must dwell on the mark before enter fires.
   * Switching from another mark, or returning during the leave grace, enters
   * immediately.
   */
  openDelay: number
  /**
   * Grace in milliseconds before a leave fires, letting the pointer travel
   * from the mark onto the popup it anchors.
   */
  closeDelay: number
  /**
   * Enter from a stationary single-finger tap, the touch replacement for
   * hover. A tap skips `openDelay`, and a tap elsewhere in the editor
   * leaves immediately. When off, taps are left alone and the mark keeps
   * its click behavior.
   */
  tap: boolean
  /**
   * Return `false` while the pointer is on the popup this mark opened: a
   * pending leave then re-checks later instead of firing.
   */
  canLeave?: () => boolean
}

/**
 * Delegate hover tracking for a rendered mark to the editor root.
 *
 * Movement within a mark is de-duplicated. The active hit is also revalidated
 * after every editor update, so deleting, replacing, or rewriting a hovered
 * mark emits leave even when the pointer itself never moves. Destroying the
 * editor or removing the extension emits leave as well.
 *
 * With `tap`, a touch tap enters too. The browser is the tap recognizer:
 * only a recognized stationary single-finger tap synthesizes the
 * compatibility mouse events and the trailing `click`; scrolls, drags,
 * long-presses, and multi-finger gestures never produce them.
 */
export function defineMarkHoverHandler<Payload>(config: MarkHoverConfig<Payload>): PlainExtension {
  const { openDelay, closeDelay, tap } = config

  /**
   * What `onHoverChange` last received, while that is a hit.
   */
  let emitted: MarkHoverHit<Payload> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  /**
   * The element of a scheduled enter, `null` for a scheduled leave,
   * `undefined` when nothing is scheduled.
   */
  let scheduledElement: HTMLElement | null | undefined
  /**
   * The type of the pointer that spawned the current event sequence:
   * compatibility mouse events carry no pointer type of their own.
   */
  let lastPointerType = ''

  const findClosestMark = (target: EventTarget | null): HTMLElement | null => {
    return isElementLike(target) ? target.closest<HTMLElement>(config.selector) : null
  }

  const findPayloadForElement = (view: EditorView, element: HTMLElement): Payload | undefined => {
    return config.findPayloadForElement
      ? config.findPayloadForElement(view, element)
      : config.findPayloadAt(view.state, view.posAtDOM(element, 0))
  }

  const cancel = (): void => {
    clearTimeout(timer)
    scheduledElement = undefined
  }

  const emit = (hit: MarkHoverHit<Payload> | undefined): void => {
    cancel()
    if (!hit && !emitted) return
    emitted = hit
    config.onHoverChange(hit)
  }

  const scheduleLeave = (): void => {
    cancel()
    scheduledElement = null
    const fire = (): void => {
      if (config.canLeave?.() === false) {
        timer = setTimeout(fire, closeDelay)
        return
      }
      emit(undefined)
    }
    timer = setTimeout(fire, closeDelay)
  }

  const enter = (view: EditorView, element: HTMLElement): void => {
    const payload = findPayloadForElement(view, element)
    if (payload == null) return
    // Switching from another mark, or returning during the leave grace,
    // skips the dwell.
    if (emitted) {
      emit({ payload, element })
      return
    }
    cancel()
    scheduledElement = element
    timer = setTimeout(() => {
      // The mark may be gone or rewritten by the time the dwell elapses.
      const fresh = element.isConnected ? findPayloadForElement(view, element) : undefined
      if (fresh == null) {
        cancel()
        return
      }
      emit({ payload: fresh, element })
    }, openDelay)
  }

  const handleOver = (view: EditorView, event: MouseEvent): void => {
    const element = findClosestMark(event.target)
    if (!element || !view.dom.contains(element)) return
    if (element === emitted?.element) {
      // Back on the active mark: void any pending leave.
      if (scheduledElement === null) cancel()
      return
    }
    if (element === scheduledElement) return
    enter(view, element)
  }

  const handleOut = (event: MouseEvent): void => {
    const active = emitted?.element ?? scheduledElement
    if (!active) return
    // `mouseout` also fires when moving onto a child of the same mark; ignore it.
    const related = event.relatedTarget
    if (related instanceof Node && active.contains(related)) return
    if (emitted) scheduleLeave()
    else cancel()
  }

  return definePlugin(
    new Plugin({
      key: config.key,
      props: {
        handleDOMEvents: {
          mouseover: (view, event) => {
            handleOver(view, event)
            return false
          },
          mouseout: (_view, event) => {
            handleOut(event)
            return false
          },
          ...(tap && {
            pointerdown: (_view, event) => {
              lastPointerType = event.pointerType
              return false
            },
            // Cancelling a tap's compatibility `mousedown` suppresses focus,
            // caret placement, and the software keyboard, and returning
            // `true` keeps ProseMirror's own mousedown handling (and with it
            // `handleClick`) away from the tap.
            mousedown: (_view, event) => {
              if (lastPointerType !== 'touch' || !findClosestMark(event.target)) {
                return false
              }
              event.preventDefault()
              return true
            },
            // The tap's activation event. On the mark, consume it either
            // way: the caret was already suppressed, and a native `<a>` must
            // not navigate. Elsewhere in the editor, a tap dismisses.
            click: (view, event) => {
              if (lastPointerType !== 'touch') return false
              const element = findClosestMark(event.target)
              if (!element || !view.dom.contains(element)) {
                emit(undefined)
                return false
              }
              event.preventDefault()
              const payload = findPayloadForElement(view, element)
              if (payload != null) emit({ payload, element })
              return true
            },
          }),
        },
      },
      view: () => ({
        update: (view) => {
          if (!emitted) return
          if (!emitted.element.isConnected || !view.dom.contains(emitted.element)) {
            emit(undefined)
            return
          }
          const payload = findPayloadForElement(view, emitted.element)
          if (payload == null || !config.isSamePayload(emitted.payload, payload)) {
            emit(undefined)
            return
          }
          emitted = { ...emitted, payload }
        },
        destroy: () => emit(undefined),
      }),
    }),
  )
}
