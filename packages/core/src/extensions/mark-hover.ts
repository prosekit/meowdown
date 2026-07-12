import { isElementLike } from '@ocavue/utils'
import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, type EditorState } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

export interface MarkHoverHit<Payload> {
  payload: Payload
  element: HTMLElement
}

export interface MarkHoverConfig<Payload> {
  /** The hovered target must sit inside this selector, tested via `closest`. */
  selector: string
  /** The payload for the mark covering `pos`, or `undefined` on a miss. */
  findPayloadAt: (state: EditorState, pos: number) => Payload | undefined
  /**
   * Resolve a hit from its rendered element. Atom mark views should use their
   * hidden content holder rather than the event coordinates, which can land on
   * an adjacent mark's document boundary.
   */
  findPayloadForElement?: (view: EditorView, element: HTMLElement) => Payload | undefined
  /** Whether a transaction left the hovered mark semantically unchanged. */
  isSamePayload: (previous: Payload, next: Payload) => boolean
  /** Fired with the hit on enter, and with `undefined` on leave. */
  onHoverChange: (hit: MarkHoverHit<Payload> | undefined) => void
}

/**
 * Delegate hover tracking for a rendered mark to the editor root.
 *
 * Movement within a mark is de-duplicated. The active hit is also revalidated
 * after every editor update, so deleting, replacing, or rewriting a hovered
 * mark emits leave even when the pointer itself never moves. Destroying the
 * editor or removing the extension emits leave as well.
 */
export function defineMarkHoverHandler<Payload>(config: MarkHoverConfig<Payload>): PlainExtension {
  let current: MarkHoverHit<Payload> | undefined

  const findPayloadForElement = (view: EditorView, element: HTMLElement): Payload | undefined => {
    return config.findPayloadForElement
      ? config.findPayloadForElement(view, element)
      : config.findPayloadAt(view.state, view.posAtDOM(element, 0))
  }

  const leave = (): void => {
    if (!current) return
    current = undefined
    config.onHoverChange(undefined)
  }

  const handleOver = (view: EditorView, event: MouseEvent): void => {
    const target = event.target
    if (!target || !isElementLike(target)) return

    const element = target.closest<HTMLElement>(config.selector)
    if (!element || !view.dom.contains(element) || element === current?.element) return

    leave()
    const payload = findPayloadForElement(view, element)
    if (payload == null) return
    current = { payload, element }
    config.onHoverChange(current)
  }

  const handleOut = (event: MouseEvent): void => {
    if (!current) return
    // `mouseout` also fires when moving onto a child of the same mark; ignore it.
    const related = event.relatedTarget
    if (related instanceof Node && current.element.contains(related)) return
    leave()
  }

  return definePlugin(
    new Plugin({
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
        },
      },
      view: () => ({
        update: (view) => {
          if (!current) return
          if (!current.element.isConnected || !view.dom.contains(current.element)) {
            leave()
            return
          }
          const payload = findPayloadForElement(view, current.element)
          if (payload == null || !config.isSamePayload(current.payload, payload)) {
            leave()
            return
          }
          current = { ...current, payload }
        },
        destroy: leave,
      }),
    }),
  )
}
