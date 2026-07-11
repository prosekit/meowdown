import type { PlainExtension } from '@prosekit/core'

import { defineMarkHoverHandler } from './mark-hover.ts'
import { findWikilinkAt, findWikilinkForElement, type WikilinkHit } from './wikilink-click.ts'

/** A wiki link currently under the pointer. */
export interface WikilinkHoverHit extends WikilinkHit {
  /** The rendered wiki-link label used as the popup anchor. */
  element: HTMLElement
}

/** Called once on wiki-link enter and with `undefined` on leave or invalidation. */
export type WikilinkHoverHandler = (hit: WikilinkHoverHit | undefined) => void

/**
 * Track the wiki link under the pointer without attaching per-link listeners.
 *
 * The handler is revalidated after document transactions and receives leave
 * when the hovered link is deleted, replaced, or changes target. Moving among
 * descendants of one label is de-duplicated.
 */
export function defineWikilinkHoverHandler(onHoverChange: WikilinkHoverHandler): PlainExtension {
  return defineMarkHoverHandler<WikilinkHit>({
    selector: '.md-wikilink-view-preview',
    findPayloadAt: findWikilinkAt,
    findPayloadForElement: findWikilinkForElement,
    isSamePayload: (previous, next) => previous.target === next.target,
    onHoverChange: (hit) => {
      onHoverChange(hit ? { ...hit.payload, element: hit.element } : undefined)
    },
  })
}
