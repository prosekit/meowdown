import type { PlainExtension } from '@prosekit/core'
import { PluginKey, type EditorState } from '@prosekit/pm/state'

import { getLinkUnitAt, type LinkUnit } from './get-link-unit-at.ts'
import { defineMarkHoverHandler, type HoverTracker, type MarkHoverHit } from './mark-hover.ts'

const linkHoverKey = new PluginKey<HoverTracker>('meowdown-link-hover')

/**
 * Delay before a cold hover enters, in ms.
 */
const OPEN_DELAY = 300

/**
 * Grace before a leave fires, in ms. The window lets a pointer travel from
 * the hovered link onto the popup it anchors.
 */
const CLOSE_DELAY = 100

export type LinkHoverHandler = (hit: MarkHoverHit<LinkUnit> | undefined) => void

export interface LinkHoverOptions {
  /**
   * Return `false` while the pointer is on the popup the link opened: a
   * pending leave then re-checks later instead of firing.
   */
  canLeave?: () => boolean
}

/**
 * Track the link under the user's attention: a mouse hover after a short
 * delay, or a touch tap immediately, since touch has no hover. Without the
 * tap entry, the popup's preview and actions would stay unreachable on
 * phones, where a tap on a link only places the caret and raises the
 * software keyboard.
 */
export function defineLinkHoverHandler(
  onHoverChange: LinkHoverHandler,
  { canLeave }: LinkHoverOptions = {},
): PlainExtension {
  return defineMarkHoverHandler<LinkUnit>({
    key: linkHoverKey,
    selector: '.md-link',
    openDelay: OPEN_DELAY,
    closeDelay: CLOSE_DELAY,
    tap: true,
    canLeave,
    findPayloadAt: (state, pos): LinkUnit | undefined => {
      return getLinkUnitAt(state, pos)
    },
    isSamePayload: (previous, next) => {
      return previous.href === next.href && previous.title === next.title
    },
    onHoverChange,
  })
}

/**
 * Tell the link hover handler that the user dismissed the UI it opened. The
 * link under the pointer stays silent until the pointer leaves it, so a
 * pending hover cannot reopen the UI.
 */
export function dismissLinkHover(state: EditorState): void {
  linkHoverKey.getState(state)?.dismiss()
}
