import { isElementLike } from '@ocavue/utils'
import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, type EditorState, type PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

export interface MarkHoverHit<Payload> {
  payload: Payload
  element: HTMLElement
}

/**
 * The hover state machine of one editor, stored as the plugin state.
 */
export interface HoverTracker {
  readonly handleOver: (view: EditorView, event: MouseEvent) => void
  readonly handleOut: (event: MouseEvent) => void
  readonly handlePointerDown: (event: PointerEvent) => void
  readonly handleMouseDown: (event: MouseEvent) => boolean
  readonly handleClick: (view: EditorView, event: MouseEvent) => boolean
  readonly update: (view: EditorView) => void
  /**
   * The UI opened by this hover was dismissed by the user. The mark under the
   * pointer stays silent until the pointer leaves it. A tap still enters.
   */
  readonly dismiss: () => void
  readonly destroy: () => void
}

export interface MarkHoverConfig<Payload> {
  key: PluginKey<HoverTracker>
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
   * Milliseconds a cold pointer must rest on the mark before enter fires.
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

type HoverPhase<Payload> =
  | { readonly kind: 'idle' }
  /**
   * The pointer rests on `element`; the open delay is running.
   */
  | { readonly kind: 'pending'; readonly element: HTMLElement; readonly view: EditorView }
  /**
   * Enter was reported and the pointer is on the mark.
   */
  | { readonly kind: 'active'; readonly hit: MarkHoverHit<Payload> }
  /**
   * Enter was reported and the pointer left; the close delay is running.
   */
  | { readonly kind: 'leaving'; readonly hit: MarkHoverHit<Payload> }
  /**
   * The user dismissed the UI; `element` stays silent until the pointer
   * leaves it.
   */
  | { readonly kind: 'dismissed'; readonly element: HTMLElement }

const IDLE = { kind: 'idle' } as const

function getHit<Payload>(phase: HoverPhase<Payload>): MarkHoverHit<Payload> | undefined {
  return phase.kind === 'active' || phase.kind === 'leaving' ? phase.hit : undefined
}

/**
 * The tracked element the pointer is on, if any.
 */
function getPointerElement<Payload>(phase: HoverPhase<Payload>): HTMLElement | undefined {
  switch (phase.kind) {
    case 'pending':
    case 'dismissed':
      return phase.element
    case 'active':
      return phase.hit.element
    default:
      return undefined
  }
}

function createHoverTracker<Payload>(config: MarkHoverConfig<Payload>): HoverTracker {
  const { openDelay, closeDelay } = config

  let phase: HoverPhase<Payload> = IDLE
  /**
   * Runs exactly while the phase is `pending` or `leaving`.
   */
  let timer: ReturnType<typeof setTimeout> | undefined
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

  /**
   * The only transition. It restarts the timer the next phase needs and
   * reports a change of the hit element.
   */
  const go = (next: HoverPhase<Payload>): void => {
    clearTimeout(timer)
    const previousHit = getHit(phase)
    phase = next
    if (next.kind === 'pending') timer = setTimeout(finishOpen, openDelay)
    if (next.kind === 'leaving') timer = setTimeout(finishLeave, closeDelay)
    const hit = getHit(next)
    if (hit?.element !== previousHit?.element) config.onHoverChange(hit)
  }

  const finishOpen = (): void => {
    if (phase.kind !== 'pending') return
    const { element, view } = phase
    // The mark may be gone or rewritten by the time the open delay elapses.
    const payload = element.isConnected ? findPayloadForElement(view, element) : undefined
    go(payload == null ? IDLE : { kind: 'active', hit: { payload, element } })
  }

  const finishLeave = (): void => {
    if (phase.kind !== 'leaving') return
    go(config.canLeave?.() === false ? phase : IDLE)
  }

  const startPending = (view: EditorView, element: HTMLElement): void => {
    if (findPayloadForElement(view, element) == null) return
    go({ kind: 'pending', element, view })
  }

  const handleOver = (view: EditorView, event: MouseEvent): void => {
    const element = findClosestMark(event.target)
    if (!element || !view.dom.contains(element)) return
    switch (phase.kind) {
      case 'idle':
        return startPending(view, element)
      case 'pending':
      case 'dismissed':
        if (element !== phase.element) startPending(view, element)
        return
      case 'active':
      case 'leaving': {
        // Switching from another mark, or returning during the leave grace,
        // skips the open delay.
        if (element === phase.hit.element) return go({ kind: 'active', hit: phase.hit })
        const payload = findPayloadForElement(view, element)
        if (payload != null) go({ kind: 'active', hit: { payload, element } })
        return
      }
    }
  }

  const handleOut = (event: MouseEvent): void => {
    const element = getPointerElement(phase)
    if (!element) return
    // `mouseout` also fires when moving onto a child of the same mark; ignore it.
    const related = event.relatedTarget
    if (related instanceof Node && element.contains(related)) return
    go(phase.kind === 'active' ? { kind: 'leaving', hit: phase.hit } : IDLE)
  }

  const handlePointerDown = (event: PointerEvent): void => {
    lastPointerType = event.pointerType
  }

  // Cancelling a tap's compatibility `mousedown` suppresses focus,
  // caret placement, and the software keyboard, and returning
  // `true` keeps ProseMirror's own mousedown handling (and with it
  // `handleClick`) away from the tap.
  const handleMouseDown = (event: MouseEvent): boolean => {
    if (lastPointerType !== 'touch' || !findClosestMark(event.target)) return false
    event.preventDefault()
    return true
  }

  // The tap's activation event. On the mark, consume it either
  // way: the caret was already suppressed, and a native `<a>` must
  // not navigate. Elsewhere in the editor, a tap dismisses.
  const handleClick = (view: EditorView, event: MouseEvent): boolean => {
    if (lastPointerType !== 'touch') return false
    const element = findClosestMark(event.target)
    if (!element || !view.dom.contains(element)) {
      go(IDLE)
      return false
    }
    event.preventDefault()
    const payload = findPayloadForElement(view, element)
    if (payload != null) go({ kind: 'active', hit: { payload, element } })
    return true
  }

  const update = (view: EditorView): void => {
    if (phase.kind === 'dismissed') {
      if (!view.dom.contains(phase.element)) go(IDLE)
      return
    }
    if (phase.kind !== 'active' && phase.kind !== 'leaving') return
    const { element } = phase.hit
    if (!element.isConnected || !view.dom.contains(element)) return go(IDLE)
    const payload = findPayloadForElement(view, element)
    if (payload == null || !config.isSamePayload(phase.hit.payload, payload)) return go(IDLE)
    // A refresh is not a transition: it must not restart the leave grace.
    phase = { kind: phase.kind, hit: { payload, element } }
  }

  const dismiss = (): void => {
    switch (phase.kind) {
      case 'pending':
        return go({ kind: 'dismissed', element: phase.element })
      case 'active':
        return go({ kind: 'dismissed', element: phase.hit.element })
      case 'leaving':
        return go(IDLE)
    }
  }

  return {
    handleOver,
    handleOut,
    handlePointerDown,
    handleMouseDown,
    handleClick,
    update,
    dismiss,
    destroy: () => go(IDLE),
  }
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
 *
 * The tracker lives in the plugin state, so `key.getState(state)?.dismiss()`
 * reaches the one tracking that editor.
 */
export function defineMarkHoverHandler<Payload>(config: MarkHoverConfig<Payload>): PlainExtension {
  const { key } = config

  return definePlugin(
    new Plugin<HoverTracker>({
      key,
      state: {
        init: () => createHoverTracker(config),
        apply: (_tr, tracker) => tracker,
      },
      props: {
        handleDOMEvents: {
          mouseover: (view, event) => {
            key.getState(view.state)?.handleOver(view, event)
            return false
          },
          mouseout: (view, event) => {
            key.getState(view.state)?.handleOut(event)
            return false
          },
          ...(config.tap && {
            pointerdown: (view, event) => {
              key.getState(view.state)?.handlePointerDown(event)
              return false
            },
            mousedown: (view, event) => {
              return key.getState(view.state)?.handleMouseDown(event) ?? false
            },
            click: (view, event) => {
              return key.getState(view.state)?.handleClick(view, event) ?? false
            },
          }),
        },
      },
      view: (view) => {
        // `reconfigure` keeps this tracker but rebuilds plugin views, and
        // `EditorState.create` makes a new one: each view owns the tracker
        // it was created with.
        const tracker = key.getState(view.state)
        return {
          update: (view) => tracker?.update(view),
          destroy: () => tracker?.destroy(),
        }
      },
    }),
  )
}
