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
 * A phase of the hover state machine. `Element` is the rendered mark and
 * `View` the editor that reported it; the transition only compares them by
 * identity.
 */
export type HoverPhase<Payload, Element, View> =
  | { readonly kind: 'idle' }
  /**
   * The pointer rests on `element`; the open delay is running.
   */
  | { readonly kind: 'pending'; readonly element: Element; readonly view: View }
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
export type HoverInput<Payload, Element, View> =
  /**
   * The pointer moved onto `element`, the closest tracked mark.
   */
  | {
      readonly type: 'over'
      readonly element: Element
      readonly view: View
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
  | {
      readonly type: 'open-elapsed'
      readonly resolve: (element: Element, view: View) => Payload | undefined
    }
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

/**
 * The outcome of one transition.
 */
export interface HoverStep<Payload, Element, View> {
  readonly phase: HoverPhase<Payload, Element, View>
  /**
   * `open` and `close` restart the timer with that delay, `none` clears it,
   * and `keep` leaves the running timer alone.
   */
  readonly timer: 'open' | 'close' | 'none' | 'keep'
  /**
   * The hit element changed: report the hit of `phase`.
   */
  readonly emit: boolean
}

const IDLE = { kind: 'idle' } as const

const PHASE_TIMERS = {
  idle: 'none',
  pending: 'open',
  active: 'none',
  leaving: 'close',
  dismissed: 'none',
} as const

function getHit<Payload, Element, View>(
  phase: HoverPhase<Payload, Element, View>,
): MarkHoverHit<Payload, Element> | undefined {
  return phase.kind === 'active' || phase.kind === 'leaving' ? phase.hit : undefined
}

/**
 * The tracked element the pointer is on, if any.
 */
function getPointerElement<Payload, Element, View>(
  phase: HoverPhase<Payload, Element, View>,
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

/**
 * A step to `next` that restarts the timer `next` needs.
 */
function stepTo<Payload, Element, View>(
  previous: HoverPhase<Payload, Element, View>,
  next: HoverPhase<Payload, Element, View>,
): HoverStep<Payload, Element, View> {
  return {
    phase: next,
    timer: PHASE_TIMERS[next.kind],
    emit: getHit(next)?.element !== getHit(previous)?.element,
  }
}

function startPending<Payload, Element, View>(
  phase: HoverPhase<Payload, Element, View>,
  input: Extract<HoverInput<Payload, Element, View>, { type: 'over' }>,
): HoverStep<Payload, Element, View> | undefined {
  if (input.resolve() == null) return
  return stepTo(phase, { kind: 'pending', element: input.element, view: input.view })
}

function transitionOver<Payload, Element, View>(
  phase: HoverPhase<Payload, Element, View>,
  input: Extract<HoverInput<Payload, Element, View>, { type: 'over' }>,
): HoverStep<Payload, Element, View> | undefined {
  switch (phase.kind) {
    case 'idle':
      return startPending(phase, input)
    case 'pending':
    case 'dismissed':
      return input.element === phase.element ? undefined : startPending(phase, input)
    case 'active':
    case 'leaving': {
      // Switching from another mark, or returning during the leave grace,
      // skips the open delay.
      if (input.element === phase.hit.element) {
        return stepTo(phase, { kind: 'active', hit: phase.hit })
      }
      const payload = input.resolve()
      if (payload == null) return
      return stepTo(phase, { kind: 'active', hit: { payload, element: input.element } })
    }
  }
}

function transitionUpdate<Payload, Element, View>(
  phase: HoverPhase<Payload, Element, View>,
  input: Extract<HoverInput<Payload, Element, View>, { type: 'update' }>,
): HoverStep<Payload, Element, View> | undefined {
  if (phase.kind === 'dismissed') {
    return input.isAttached(phase.element) ? undefined : stepTo(phase, IDLE)
  }
  if (phase.kind !== 'active' && phase.kind !== 'leaving') return
  const { element } = phase.hit
  const payload = input.resolve(element)
  if (payload == null || !input.isSamePayload(phase.hit.payload, payload)) {
    return stepTo(phase, IDLE)
  }
  // A refresh is not a transition: it must not restart the leave grace.
  return { phase: { kind: phase.kind, hit: { payload, element } }, timer: 'keep', emit: false }
}

function transitionDismiss<Payload, Element, View>(
  phase: HoverPhase<Payload, Element, View>,
): HoverStep<Payload, Element, View> | undefined {
  switch (phase.kind) {
    case 'pending':
      return stepTo(phase, { kind: 'dismissed', element: phase.element })
    case 'active':
      return stepTo(phase, { kind: 'dismissed', element: phase.hit.element })
    case 'leaving':
      return stepTo(phase, IDLE)
    default:
      return undefined
  }
}

/**
 * The hover state machine as a pure function. Returns `undefined` when
 * `input` leaves `phase` as it is.
 */
export function transitionHover<Payload, Element, View>(
  phase: HoverPhase<Payload, Element, View>,
  input: HoverInput<Payload, Element, View>,
): HoverStep<Payload, Element, View> | undefined {
  switch (input.type) {
    case 'over':
      return transitionOver(phase, input)
    case 'out': {
      const element = getPointerElement(phase)
      if (element == null || input.isWithin(element)) return
      return stepTo(phase, phase.kind === 'active' ? { kind: 'leaving', hit: phase.hit } : IDLE)
    }
    case 'open-elapsed': {
      if (phase.kind !== 'pending') return
      const { element, view } = phase
      const payload = input.resolve(element, view)
      return stepTo(phase, payload == null ? IDLE : { kind: 'active', hit: { payload, element } })
    }
    case 'close-elapsed':
      if (phase.kind !== 'leaving') return
      return stepTo(phase, input.canLeave() ? IDLE : phase)
    case 'tap': {
      const payload = input.resolve()
      if (payload == null) return
      return stepTo(phase, { kind: 'active', hit: { payload, element: input.element } })
    }
    case 'update':
      return transitionUpdate(phase, input)
    case 'dismiss':
      return transitionDismiss(phase)
    case 'reset':
      return stepTo(phase, IDLE)
  }
}

function createHoverTracker<Payload>(config: MarkHoverConfig<Payload>): HoverTracker {
  const { openDelay, closeDelay } = config

  let phase: HoverPhase<Payload, HTMLElement, EditorView> = IDLE
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
   * The only way to change the phase. It applies the timer the step asks for
   * and reports a change of the hit element.
   */
  const send = (input: HoverInput<Payload, HTMLElement, EditorView>): void => {
    const step = transitionHover(phase, input)
    if (!step) return
    if (step.timer !== 'keep') clearTimeout(timer)
    phase = step.phase
    if (step.timer === 'open') timer = setTimeout(finishOpen, openDelay)
    if (step.timer === 'close') timer = setTimeout(finishLeave, closeDelay)
    if (step.emit) config.onHoverChange(getHit(phase))
  }

  const finishOpen = (): void => {
    send({
      type: 'open-elapsed',
      // The mark may be gone or rewritten by the time the open delay elapses.
      resolve: (element, view) => {
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
    send({ type: 'over', element, view, resolve: () => findPayloadForElement(view, element) })
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
