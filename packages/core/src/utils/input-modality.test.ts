import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  getInputModality,
  hasTouchScreen,
  onInputModalityChange,
  resetInputModalityForTest,
} from './input-modality.ts'

function stubMaxTouchPoints(value: number): void {
  Object.defineProperty(navigator, 'maxTouchPoints', { value, configurable: true })
}

function dispatchPointerDown(pointerType: string): void {
  window.dispatchEvent(new PointerEvent('pointerdown', { pointerType }))
}

function dispatchKeyDown(init: KeyboardEventInit, keyCode?: number): void {
  const event = new KeyboardEvent('keydown', init)
  // `keyCode` is not constructible via KeyboardEventInit.
  if (keyCode != null) Object.defineProperty(event, 'keyCode', { value: keyCode })
  window.dispatchEvent(event)
}

// The browser test runner has no touch screen, so the touch capability is
// stubbed per test via `maxTouchPoints`.
describe('input modality', () => {
  beforeEach(() => {
    resetInputModalityForTest()
    stubMaxTouchPoints(5)
  })

  afterEach(() => {
    stubMaxTouchPoints(0)
    resetInputModalityForTest()
  })

  it('reports the touch capability from maxTouchPoints', () => {
    expect(hasTouchScreen()).toBe(true)
    stubMaxTouchPoints(0)
    expect(hasTouchScreen()).toBe(false)
  })

  it('defaults to touch on a touch screen before any event', () => {
    expect(getInputModality()).toBe('touch')
  })

  it('is always keyboard without a touch screen', () => {
    stubMaxTouchPoints(0)
    expect(getInputModality()).toBe('keyboard')
    dispatchPointerDown('touch')
    expect(getInputModality()).toBe('keyboard')
  })

  it('flips to keyboard on an arrow key', () => {
    dispatchKeyDown({ key: 'ArrowLeft' })
    expect(getInputModality()).toBe('keyboard')
  })

  it('flips to keyboard on Home, End, PageUp and PageDown', () => {
    for (const key of ['Home', 'End', 'PageUp', 'PageDown']) {
      resetInputModalityForTest()
      dispatchKeyDown({ key })
      expect(getInputModality()).toBe('keyboard')
    }
  })

  it('flips to keyboard on a modifier combo', () => {
    dispatchKeyDown({ key: 'a', metaKey: true })
    expect(getInputModality()).toBe('keyboard')
    resetInputModalityForTest()
    dispatchKeyDown({ key: 'b', ctrlKey: true })
    expect(getInputModality()).toBe('keyboard')
  })

  it('ignores letter, space, Enter and Backspace keys', () => {
    for (const key of ['a', 'Z', ' ', 'Enter', 'Backspace', 'Shift']) {
      dispatchKeyDown({ key })
      expect(getInputModality()).toBe('touch')
    }
  })

  it('ignores an IME keydown', () => {
    dispatchKeyDown({ key: 'ArrowLeft', isComposing: true })
    expect(getInputModality()).toBe('touch')
    dispatchKeyDown({ key: 'ArrowLeft' }, 229)
    expect(getInputModality()).toBe('touch')
  })

  it('flips back to touch on a touch or pen pointerdown', () => {
    dispatchKeyDown({ key: 'ArrowLeft' })
    expect(getInputModality()).toBe('keyboard')
    dispatchPointerDown('touch')
    expect(getInputModality()).toBe('touch')
    dispatchKeyDown({ key: 'ArrowRight' })
    dispatchPointerDown('pen')
    expect(getInputModality()).toBe('touch')
  })

  it('flips to keyboard on a mouse pointerdown', () => {
    dispatchPointerDown('mouse')
    expect(getInputModality()).toBe('keyboard')
  })

  it('notifies listeners only on a change', () => {
    let calls = 0
    const unsubscribe = onInputModalityChange(() => {
      calls += 1
    })
    dispatchPointerDown('touch')
    expect(calls).toBe(1)
    dispatchPointerDown('touch')
    expect(calls).toBe(1)
    dispatchKeyDown({ key: 'ArrowLeft' })
    expect(calls).toBe(2)
    unsubscribe()
    dispatchPointerDown('touch')
    expect(calls).toBe(2)
  })
})
