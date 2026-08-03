import { getIsComposing } from './composition.ts'

export type InputModality = 'touch' | 'keyboard'

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

let lastModality: InputModality | undefined

const listeners = new Set<() => void>()

function setModality(modality: InputModality): void {
  if (modality === lastModality) return
  lastModality = modality
  for (const listener of listeners) listener()
}

function handlePointerDown(event: PointerEvent): void {
  if (event.pointerType === 'touch' || event.pointerType === 'pen') {
    setModality('touch')
  } else if (event.pointerType === 'mouse') {
    // Safe against iOS's synthetic mouse events: those fire after a tap
    // without a pointerdown of their own, so a mouse pointerdown is a real
    // pointing device.
    setModality('keyboard')
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  // An IME sequence, whatever key it claims to carry.
  // eslint-disable-next-line unicorn/prefer-keyboard-event-key
  if (getIsComposing() || event.isComposing || event.keyCode === 229) return
  if (KEYBOARD_MODALITY_KEYS.has(event.key) || event.metaKey || event.ctrlKey) {
    setModality('keyboard')
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true })
  window.addEventListener('keydown', handleKeyDown, { capture: true, passive: true })
}

/** Whether the device has a touch screen. */
export function hasTouchScreen(): boolean {
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
}

/**
 * How the user last drove the selection: a finger (or pen) on the screen, or
 * precise input (hardware keyboard navigation, a mouse or trackpad).
 *
 * On a touch screen this starts as `'touch'` and follows the events. Only
 * navigation keys and modifier combos count as keyboard input: letter keys are
 * ignored because a software keyboard sends them too, and the software
 * keyboard's own caret gestures (a spacebar long-press drag) reach the page as
 * bare `selectionchange` events with no key or touch events at all, so staying
 * on the previous modality is the correct reading for them. Without a touch
 * screen this is always `'keyboard'`.
 */
export function getInputModality(): InputModality {
  if (!hasTouchScreen()) return 'keyboard'
  return lastModality ?? 'touch'
}

/** Calls `listener` whenever {@link getInputModality} may report a new value. */
export function onInputModalityChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** @internal Restores the initial no-events-yet state between tests. */
export function resetInputModalityForTest(): void {
  lastModality = undefined
}
