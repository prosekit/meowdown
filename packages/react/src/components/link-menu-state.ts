import type { LinkEditOptions, LinkUnit } from '@meowdown/core'

export type LinkMenuView =
  | { readonly kind: 'preview'; readonly link: LinkUnit }
  | { readonly kind: 'edit'; readonly edit: LinkEditOptions }

export type LinkMenuState =
  | { readonly kind: 'idle' }
  | LinkMenuView
  /**
   * Kept through the exit animation so the popup does not empty mid-fade.
   */
  | { readonly kind: 'closing'; readonly view: LinkMenuView }

export type LinkMenuEvent =
  /**
   * The link under the pointer changed, `undefined` when it left.
   */
  | { readonly type: 'hover'; readonly link: LinkUnit | undefined }
  | { readonly type: 'edit'; readonly edit: LinkEditOptions }
  /**
   * The user dismissed the popup.
   */
  | { readonly type: 'close' }
  /**
   * The exit animation finished.
   */
  | { readonly type: 'closed' }

export const LINK_MENU_IDLE: LinkMenuState = { kind: 'idle' }

/**
 * What the popup renders: the open view, or the closing one during the exit
 * animation.
 */
export function getLinkMenuView(state: LinkMenuState): LinkMenuView | undefined {
  switch (state.kind) {
    case 'idle':
      return undefined
    case 'closing':
      return state.view
    default:
      return state
  }
}

export function reduceLinkMenu(state: LinkMenuState, event: LinkMenuEvent): LinkMenuState {
  switch (event.type) {
    case 'hover':
      if (state.kind === 'edit') return state
      if (event.link) return { kind: 'preview', link: event.link }
      return state.kind === 'preview' ? { kind: 'closing', view: state } : state
    case 'edit':
      return { kind: 'edit', edit: event.edit }
    case 'close':
      return state.kind === 'preview' || state.kind === 'edit'
        ? { kind: 'closing', view: state }
        : state
    case 'closed':
      return state.kind === 'closing' ? LINK_MENU_IDLE : state
  }
}
