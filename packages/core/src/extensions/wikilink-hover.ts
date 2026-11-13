import type { PlainExtension } from '@prosekit/core'
import { PluginKey } from '@prosekit/pm/state'

import { WIKILINK_VIEW_PREVIEW_CLASS } from '../class-names.ts'

import { defineMarkHoverHandler, type HoverTracker } from './mark-hover.ts'
import { findWikilinkAt, findWikilinkForElement, type WikilinkHit } from './wikilink-click.ts'

const wikilinkHoverKey = new PluginKey<HoverTracker>('meowdown-wikilink-hover')

/**
 * Delay before a cold hover enters, in ms.
 */
const OPEN_DELAY = 300

/**
 * Grace before a leave fires, in ms. Returning within it re-enters without
 * a new delay.
 */
const CLOSE_DELAY = 100

/**
 * A wikilink currently under the pointer.
 */
export interface WikilinkHoverHit extends WikilinkHit {
  /**
   * The rendered wikilink label used as the popup anchor.
   */
  element: HTMLElement
}

/**
 * Called once on wikilink enter and with `undefined` on leave or invalidation.
 */
export type WikilinkHoverHandler = (hit: WikilinkHoverHit | undefined) => void

/**
 * Track the wikilink the pointer rests on without attaching per-link
 * listeners.
 *
 * A cold pointer must rest on a link for a short delay before enter fires.
 * Moving to an adjacent link restarts the delay, or switches at once when a
 * link is already entered. Leave fires a short grace after the pointer
 * leaves, and immediately when the hovered link is deleted, replaced, or
 * changes target. Moving among descendants of one label is de-duplicated.
 */
export function defineWikilinkHoverHandler(onHoverChange: WikilinkHoverHandler): PlainExtension {
  return defineMarkHoverHandler<WikilinkHit>({
    key: wikilinkHoverKey,
    selector: `.${WIKILINK_VIEW_PREVIEW_CLASS}`,
    openDelay: OPEN_DELAY,
    closeDelay: CLOSE_DELAY,
    // A touch tap must keep navigating: the card is inert.
    tap: false,
    findPayloadAt: findWikilinkAt,
    findPayloadForElement: findWikilinkForElement,
    isSamePayload: (previous, next) => previous.target === next.target,
    onHoverChange: (hit) => {
      onHoverChange(hit ? { ...hit.payload, element: hit.element } : undefined)
    },
  })
}
