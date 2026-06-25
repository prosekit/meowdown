import { isElementLike } from '@ocavue/utils'
import { defineDOMEventHandler, type PlainExtension, union } from '@prosekit/core'
import type { EditorState } from '@prosekit/pm/state'
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
  /** Fired with the hit on enter, and with `undefined` on leave. */
  onHoverChange: (hit: MarkHoverHit<Payload> | undefined) => void
}

export function defineMarkHoverHandler<Payload>(config: MarkHoverConfig<Payload>): PlainExtension {
  let current: HTMLElement | undefined

  const handleOver = (view: EditorView, event: MouseEvent): void => {
    const target = event.target
    if (!target || !isElementLike(target)) return

    const element = target.closest<HTMLElement>(config.selector)
    if (!element || element === current) return

    const pos = view.posAtDOM(element, 0)
    const payload = config.findPayloadAt(view.state, pos)
    if (payload == null) return
    current = element
    config.onHoverChange({ payload, element })
  }

  const handleOut = (event: MouseEvent): void => {
    if (!current) return
    // `mouseout` also fires when moving onto a child of the same mark; ignore it.
    const related = event.relatedTarget as Node | undefined
    if (related && current.contains(related)) return
    current = undefined
    config.onHoverChange(undefined)
  }

  return union(
    defineDOMEventHandler('mouseover', (view, event) => handleOver(view, event)),
    defineDOMEventHandler('mouseout', (_view, event) => handleOut(event)),
  )
}
