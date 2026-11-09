import type { EmbedTarget } from '@meowdown/core'

export type EmbedMenuState =
  | {
      readonly phase: 'idle'
    }
  | {
      /**
       * The menu is open over `embed`, anchored to its menu `button`.
       */
      readonly phase: 'open'
      readonly embed: EmbedTarget
      readonly button: HTMLElement
    }
  | {
      /**
       * The menu plays its exit animation, still anchored to `button`.
       */
      readonly phase: 'closing'
      readonly embed: EmbedTarget
      readonly button: HTMLElement
    }

export type EmbedMenuEvent =
  | {
      readonly type: 'open'
      readonly embed: EmbedTarget
      readonly button: HTMLElement
    }
  | {
      /**
       * The menu starts to close.
       */
      readonly type: 'close'
    }
  | {
      /**
       * The exit animation finished.
       */
      readonly type: 'closed'
    }

export const EMBED_MENU_IDLE: EmbedMenuState = { phase: 'idle' }

export function reduceEmbedMenu(state: EmbedMenuState, event: EmbedMenuEvent): EmbedMenuState {
  switch (event.type) {
    case 'open':
      return { phase: 'open', embed: event.embed, button: event.button }
    case 'close':
      return state.phase === 'open' ? { ...state, phase: 'closing' } : state
    case 'closed':
      return state.phase === 'closing' ? EMBED_MENU_IDLE : state
  }
}
