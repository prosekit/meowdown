export type CodeBlockToolbarPopup = 'menu' | 'language'

/**
 * Where the focus goes when the last open popup closes: back into the editor
 * (the popup opened from the keyboard shortcut) or to the popup trigger.
 */
export type CodeBlockToolbarFocusReturn = 'editor' | 'trigger'

export interface CodeBlockToolbarState {
  /**
   * The open popup. At most one popup is open at a time.
   */
  readonly open: CodeBlockToolbarPopup | undefined
  /**
   * The popups that play their exit animation. Never holds `open`.
   */
  readonly closing: readonly CodeBlockToolbarPopup[]
  /**
   * Set by each `open` event. Kept after the popups close, because a popup
   * reads it when it unmounts at the end of its exit animation.
   */
  readonly focusReturn: CodeBlockToolbarFocusReturn
}

export type CodeBlockToolbarEvent =
  | {
      readonly type: 'open'
      readonly popup: CodeBlockToolbarPopup
      readonly focusReturn: CodeBlockToolbarFocusReturn
    }
  /**
   * The menu closes and the language picker opens in its place. The focus
   * return of the menu carries over.
   */
  | { readonly type: 'handOver' }
  /**
   * The popup starts to close.
   */
  | { readonly type: 'close'; readonly popup: CodeBlockToolbarPopup }
  /**
   * The exit animation of the popup finished.
   */
  | { readonly type: 'closed'; readonly popup: CodeBlockToolbarPopup }

export const CODE_BLOCK_TOOLBAR_IDLE: CodeBlockToolbarState = {
  open: undefined,
  closing: [],
  focusReturn: 'trigger',
}

function switchPopup(
  state: CodeBlockToolbarState,
  popup: CodeBlockToolbarPopup,
  focusReturn: CodeBlockToolbarFocusReturn,
): CodeBlockToolbarState {
  const closing = state.closing.filter((item) => item !== popup)
  if (state.open != null && state.open !== popup) closing.push(state.open)
  return { open: popup, closing, focusReturn }
}

export function reduceCodeBlockToolbar(
  state: CodeBlockToolbarState,
  event: CodeBlockToolbarEvent,
): CodeBlockToolbarState {
  switch (event.type) {
    case 'open':
      return switchPopup(state, event.popup, event.focusReturn)
    case 'handOver':
      return state.open === 'menu' ? switchPopup(state, 'language', state.focusReturn) : state
    case 'close':
      return state.open === event.popup
        ? { ...state, open: undefined, closing: [...state.closing, event.popup] }
        : state
    case 'closed':
      return state.closing.includes(event.popup)
        ? { ...state, closing: state.closing.filter((item) => item !== event.popup) }
        : state
  }
}

/**
 * Whether the toolbar stays shown: a popup is open or plays its exit animation.
 */
export function isCodeBlockToolbarActive(state: CodeBlockToolbarState): boolean {
  return state.open != null || state.closing.length > 0
}

/**
 * Where a closing popup sends the focus. `undefined` when another popup is
 * open and owns the focus.
 */
export function getCodeBlockToolbarFinalFocus(
  state: CodeBlockToolbarState,
): CodeBlockToolbarFocusReturn | undefined {
  return state.open == null ? state.focusReturn : undefined
}
