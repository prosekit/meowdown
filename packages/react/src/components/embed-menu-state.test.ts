import type { EmbedTarget } from '@meowdown/core'
import { describe, expect, it } from 'vitest'

import { EMBED_MENU_IDLE, reduceEmbedMenu, type EmbedMenuState } from './embed-menu-state.ts'

const embed: EmbedTarget = {
  kind: 'x-post',
  src: 'https://x.com/jack/status/20',
  alt: '',
  from: 1,
  to: 31,
}
const otherEmbed: EmbedTarget = { ...embed, from: 40, to: 70 }
const button = {} as HTMLElement
const otherButton = {} as HTMLElement

describe('reduceEmbedMenu', () => {
  it('opens, closes, and returns to idle after the exit animation', () => {
    let state: EmbedMenuState = reduceEmbedMenu(EMBED_MENU_IDLE, { type: 'open', embed, button })
    expect(state).toEqual({ phase: 'open', embed, button })
    state = reduceEmbedMenu(state, { type: 'close' })
    expect(state).toEqual({ phase: 'closing', embed, button })
    state = reduceEmbedMenu(state, { type: 'closed' })
    expect(state).toBe(EMBED_MENU_IDLE)
  })

  it('moves to another card while the menu is closing', () => {
    let state = reduceEmbedMenu(EMBED_MENU_IDLE, { type: 'open', embed, button })
    state = reduceEmbedMenu(state, { type: 'close' })
    state = reduceEmbedMenu(state, { type: 'open', embed: otherEmbed, button: otherButton })
    expect(state).toEqual({ phase: 'open', embed: otherEmbed, button: otherButton })
    // The exit animation of the previous card must not close the new menu.
    expect(reduceEmbedMenu(state, { type: 'closed' })).toBe(state)
  })

  it('ignores a close while idle', () => {
    expect(reduceEmbedMenu(EMBED_MENU_IDLE, { type: 'close' })).toBe(EMBED_MENU_IDLE)
  })
})
