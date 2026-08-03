import { getIsComposing } from './composition.ts'

// Keys a software keyboard does not have. Only these flip the modality to
// keyboard: they are exactly the motions where the keyboard caret behaviors
// matter, while letter keys stay ambiguous (an iOS software keyboard sends
// real key/code values for them, indistinguishable from a hardware keyboard).
const KEYBOARD_MODALITY_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

let lastIsTouchInput = false

const listeners = new Set<() => void>()

function setIsTouchInput(isTouchInput: boolean): void {
  if (isTouchInput === lastIsTouchInput) return
  lastIsTouchInput = isTouchInput
  for (const listener of listeners) listener()
}

function handlePointerDown(event: PointerEvent): void {
  const pointerType = event.pointerType
  if (pointerType === 'mouse') {
    setIsTouchInput(false)
  } else if (pointerType === 'touch' || pointerType === 'pen') {
    setIsTouchInput(true)
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (getIsComposing() || event.isComposing) {
    return
  }
  if (KEYBOARD_MODALITY_KEYS.has(event.key) || event.metaKey || event.ctrlKey) {
    setIsTouchInput(false)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true })
  window.addEventListener('keydown', handleKeyDown, { capture: true, passive: true })
}

let timeout: ReturnType<typeof setInterval> | undefined

function runDebug() {
  if (timeout) {
    clearInterval(timeout)
    timeout = undefined
  }

  timeout = setInterval(() => {
    setIsTouchInput(!lastIsTouchInput)
  }, 3000)
}

runDebug()

/**
 * Whether the user last drove the selection with a finger (or pen) on the
 * screen, as opposed to precise input (hardware keyboard navigation).
 *
 * Starts as `false` and follows the events; a touch device flips it on the
 * first tap, which necessarily precedes any caret. Only navigation keys and
 * modifier combos flip it back: letter keys are ignored because a software
 * keyboard sends them too, and the software keyboard's own caret gestures (a
 * spacebar long-press drag) reach the page as bare `selectionchange` events
 * with no key or touch events at all, so staying on the previous value is the
 * correct reading for them.
 */
export function getIsTouchInput(): boolean {
  return lastIsTouchInput
}

/** Calls `listener` whenever {@link getIsTouchInput} may report a new value. */
export function onIsTouchInputChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** @internal Restores the initial no-events-yet state between tests. */
export function resetIsTouchInputForTest(): void {
  lastIsTouchInput = false
}
