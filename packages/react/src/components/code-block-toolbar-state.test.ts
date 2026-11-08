import { describe, expect, it } from 'vitest'

import {
  CODE_BLOCK_TOOLBAR_IDLE,
  getCodeBlockToolbarFinalFocus,
  isCodeBlockToolbarActive,
  reduceCodeBlockToolbar,
  type CodeBlockToolbarEvent,
  type CodeBlockToolbarState,
} from './code-block-toolbar-state.ts'

function run(...events: CodeBlockToolbarEvent[]): CodeBlockToolbarState {
  return events.reduce(reduceCodeBlockToolbar, CODE_BLOCK_TOOLBAR_IDLE)
}

describe('reduceCodeBlockToolbar', () => {
  it('is inactive when idle', () => {
    expect(isCodeBlockToolbarActive(CODE_BLOCK_TOOLBAR_IDLE)).toBe(false)
  })

  it('opens the menu from the shortcut and returns the focus to the editor', () => {
    const open = run({ type: 'open', popup: 'menu', focusReturn: 'editor' })
    expect(open).toEqual({ open: 'menu', closing: [], focusReturn: 'editor' })

    const closing = reduceCodeBlockToolbar(open, { type: 'close', popup: 'menu' })
    expect(closing).toEqual({ open: undefined, closing: ['menu'], focusReturn: 'editor' })
    expect(isCodeBlockToolbarActive(closing)).toBe(true)
    expect(getCodeBlockToolbarFinalFocus(closing)).toBe('editor')

    const closed = reduceCodeBlockToolbar(closing, { type: 'closed', popup: 'menu' })
    expect(closed).toEqual({ open: undefined, closing: [], focusReturn: 'editor' })
    expect(isCodeBlockToolbarActive(closed)).toBe(false)
    expect(getCodeBlockToolbarFinalFocus(closed)).toBe('editor')
  })

  it('hands the menu over to the language picker', () => {
    const state = run(
      { type: 'open', popup: 'menu', focusReturn: 'editor' },
      { type: 'handOver' },
      { type: 'close', popup: 'menu' },
    )
    expect(state).toEqual({ open: 'language', closing: ['menu'], focusReturn: 'editor' })
    expect(getCodeBlockToolbarFinalFocus(state)).toBeUndefined()

    const done = run(
      { type: 'open', popup: 'menu', focusReturn: 'editor' },
      { type: 'handOver' },
      { type: 'closed', popup: 'menu' },
      { type: 'close', popup: 'language' },
      { type: 'closed', popup: 'language' },
    )
    expect(done).toEqual({ open: undefined, closing: [], focusReturn: 'editor' })
    expect(getCodeBlockToolbarFinalFocus(done)).toBe('editor')
  })

  it('ignores a hand over when the menu is not open', () => {
    expect(run({ type: 'handOver' })).toBe(CODE_BLOCK_TOOLBAR_IDLE)
  })

  it('resets the focus return on the next open', () => {
    const state = run(
      { type: 'open', popup: 'menu', focusReturn: 'editor' },
      { type: 'close', popup: 'menu' },
      { type: 'closed', popup: 'menu' },
      { type: 'open', popup: 'language', focusReturn: 'trigger' },
      { type: 'close', popup: 'language' },
    )
    expect(getCodeBlockToolbarFinalFocus(state)).toBe('trigger')
  })

  it('keeps a popup open when it reopens during its exit animation', () => {
    const state = run(
      { type: 'open', popup: 'menu', focusReturn: 'trigger' },
      { type: 'close', popup: 'menu' },
      { type: 'open', popup: 'menu', focusReturn: 'trigger' },
      { type: 'closed', popup: 'menu' },
    )
    expect(state).toEqual({ open: 'menu', closing: [], focusReturn: 'trigger' })
  })

  it('ignores a close for a popup that is not open', () => {
    const state = run({ type: 'open', popup: 'menu', focusReturn: 'trigger' })
    expect(reduceCodeBlockToolbar(state, { type: 'close', popup: 'language' })).toBe(state)
  })
})
