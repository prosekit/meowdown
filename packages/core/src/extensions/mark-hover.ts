import { isElementLike } from '@ocavue/utils'
import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, type EditorState, type PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

export interface MarkHoverHit<Payload, Element = HTMLElement> {
  payload: Payload
  element: Element
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

/**
 * A phase of the hover state machine. `Element` is the rendered mark; the
 * transition only compares it by identity.
 */
export type HoverPhase<Payload, Element> =
  | { readonly kind: 'idle' }
  /**
   * The pointer rests on `element`; the open delay is running.
   */
  | { readonly kind: 'pending'; readonly element: Element }
  /**
   * Enter was reported and the pointer is on the mark.
   */
  | { readonly kind: 'active'; readonly hit: MarkHoverHit<Payload, Element> }
  /**
   * Enter was reported and the pointer left; the close delay is running.
   */
  | { readonly kind: 'leaving'; readonly hit: MarkHoverHit<Payload, Element> }
  /**
   * The user dismissed the UI; `element` stays silent until the pointer
   * leaves it.
   */
  | { readonly kind: 'dismissed'; readonly element: Element }

/**
 * An event the hover state machine reacts to. The caller resolves every DOM
 * and editor lookup, so a transition touches no DOM and no timer.
 */
export type HoverInput<Payload, Element> =
  /**
   * The pointer moved onto `element`, the closest tracked mark.
   */
  | {
      readonly type: 'over'
      readonly element: Element
      readonly resolve: () => Payload | undefined
    }
  /**
   * The pointer moved off a mark. `isWithin` tells whether it landed on a
   * descendant of the given element.
   */
  | { readonly type: 'out'; readonly isWithin: (element: Element) => boolean }
  /**
   * The open delay elapsed.
   */
  | { readonly type: 'open-elapsed'; readonly resolve: (element: Element) => Payload | undefined }
  /**
   * The close delay elapsed.
   */
  | { readonly type: 'close-elapsed'; readonly canLeave: () => boolean }
  /**
   * A touch tap landed on `element`, the closest tracked mark.
   */
  | { readonly type: 'tap'; readonly element: Element; readonly resolve: () => Payload | undefined }
  /**
   * The editor updated.
   */
  | {
      readonly type: 'update'
      readonly isAttached: (element: Element) => boolean
      readonly resolve: (element: Element) => Payload | undefined
      readonly isSamePayload: (previous: Payload, next: Payload) => boolean
    }
  /**
   * The user dismissed the UI.
   */
  | { readonly type: 'dismiss' }
  /**
   * Go idle: a tap outside every mark, or the editor is destroyed.
   */
  | { readonly type: 'reset' }

const IDLE = { kind: 'idle' } as const

function getHit<Payload, Element>(
  phase: HoverPhase<Payload, Element>,
): MarkHoverHit<Payload, Element> | undefined {
  return phase.kind === 'active' || phase.kind === 'leaving' ? phase.hit : undefined
}

/**
 * The tracked element the pointer is on, if any.
 */
function getPointerElement<Payload, Element>(
  phase: HoverPhase<Payload, Element>,
): Element | undefined {
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

function transitionOver<Payload, Element>(
  phase: HoverPhase<Payload, Element>,
  input: Extract<HoverInput<Payload, Element>, { type: 'over' }>,
): HoverPhase<Payload, Element> | undefined {
  const { element } = input
  switch (phase.kind) {
    case 'idle':
    case 'pending':
    case 'dismissed':
      if (phase.kind !== 'idle' && element === phase.element) return
      return input.resolve() == null ? undefined : { kind: 'pending', element }
    case 'active':
    case 'leaving': {
      // Switching from another mark, or returning during the leave grace,
      // skips the open delay.
      if (element === phase.hit.element) return { kind: 'active', hit: phase.hit }
      const payload = input.resolve()
      return payload == null ? undefined : { kind: 'active', hit: { payload, element } }
    }
  }
}

/**
 * The hover state machine as a pure function. Returns the phase to enter,
 * or `undefined` when `input` is ignored. Entering a phase restarts its timer.
 */
export function transitionHover<Payload, Element>(
  phase: HoverPhase<Payload, Element>,
  input: HoverInput<Payload, Element>,
): HoverPhase<Payload, Element> | undefined {
  switch (input.type) {
    case 'over':
      return transitionOver(phase, input)
    case 'out': {
      const element = getPointerElement(phase)
      if (element == null || input.isWithin(element)) return
      return phase.kind === 'active' ? { kind: 'leaving', hit: phase.hit } : IDLE
    }
    case 'open-elapsed': {
      if (phase.kind !== 'pending') return
      const { element } = phase
      const payload = input.resolve(element)
      return payload == null ? IDLE : { kind: 'active', hit: { payload, element } }
    }
    case 'close-elapsed':
      if (phase.kind !== 'leaving') return
      return input.canLeave() ? IDLE : phase
    case 'tap': {
      const payload = input.resolve()
      return payload == null
        ? undefined
        : { kind: 'active', hit: { payload, element: input.element } }
    }
    case 'update': {
      if (phase.kind === 'dismissed') return input.isAttached(phase.element) ? undefined : IDLE
      const hit = getHit(phase)
      if (!hit) return
      const payload = input.resolve(hit.element)
      return payload != null && input.isSamePayload(hit.payload, payload) ? undefined : IDLE
    }
    case 'dismiss':
      switch (phase.kind) {
        case 'pending':
          return { kind: 'dismissed', element: phase.element }
        case 'active':
          return { kind: 'dismissed', element: phase.hit.element }
        case 'leaving':
          return IDLE
        default:
          return undefined
      }
    case 'reset':
      return IDLE
  }
}

function createHoverTracker<Payload>(config: MarkHoverConfig<Payload>): HoverTracker {
  const { openDelay, closeDelay } = config

  let phase: HoverPhase<Payload, HTMLElement> = IDLE
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
   * The only way to change the phase. It restarts the timer the next phase
   * needs and reports a change of the hit element.
   */
  const send = (input: HoverInput<Payload, HTMLElement>, view?: EditorView): void => {
    const next = transitionHover(phase, input)
    if (!next) return
    clearTimeout(timer)
    const previousHit = getHit(phase)
    phase = next
    if (next.kind === 'pending' && view) timer = setTimeout(finishOpen, openDelay, view)
    if (next.kind === 'leaving') timer = setTimeout(finishLeave, closeDelay)
    const hit = getHit(next)
    if (hit?.element !== previousHit?.element) config.onHoverChange(hit)
  }

  const finishOpen = (view: EditorView): void => {
    send({
      type: 'open-elapsed',
      // The mark may be gone or rewritten by the time the open delay elapses.
      resolve: (element) => {
        return element.isConnected ? findPayloadForElement(view, element) : undefined
      },
    })
  }

  const finishLeave = (): void => {
    send({ type: 'close-elapsed', canLeave: () => config.canLeave?.() !== false })
  }

  const handleOver = (view: EditorView, event: MouseEvent): void => {
    const element = findClosestMark(event.target)
    if (!element || !view.dom.contains(element)) return
    send({ type: 'over', element, resolve: () => findPayloadForElement(view, element) }, view)
  }

  const handleOut = (event: MouseEvent): void => {
    // `mouseout` also fires when moving onto a child of the same mark; ignore it.
    const related = event.relatedTarget
    send({
      type: 'out',
      isWithin: (element) => related instanceof Node && element.contains(related),
    })
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
      send({ type: 'reset' })
      return false
    }
    event.preventDefault()
    send({ type: 'tap', element, resolve: () => findPayloadForElement(view, element) })
    return true
  }

  const update = (view: EditorView): void => {
    send({
      type: 'update',
      isAttached: (element) => view.dom.contains(element),
      resolve: (element) => {
        return element.isConnected && view.dom.contains(element)
          ? findPayloadForElement(view, element)
          : undefined
      },
      isSamePayload: config.isSamePayload,
    })
  }

  return {
    handleOver,
    handleOut,
    handlePointerDown,
    handleMouseDown,
    handleClick,
    update,
    dismiss: () => send({ type: 'dismiss' }),
    destroy: () => send({ type: 'reset' }),
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
