import type { PlainExtension } from '@prosekit/core'
import { PluginKey } from '@prosekit/pm/state'

import { defineMarkHoverHandler } from './mark-hover.ts'
import { findWikilinkAt, findWikilinkForElement, type WikilinkHit } from './wikilink-click.ts'

const wikilinkHoverKey = new PluginKey('meowdown-wikilink-hover')

/** A wikilink currently under the pointer. */
export interface WikilinkHoverHit extends WikilinkHit {
  /** The rendered wikilink label used as the popup anchor. */
  element: HTMLElement
}

/** Called once on wikilink enter and with `undefined` on leave or invalidation. */
export type WikilinkHoverHandler = (hit: WikilinkHoverHit | undefined) => void

/**
 * Track the wikilink under the pointer without attaching per-link listeners.
 *
 * The handler is revalidated after document transactions and receives leave
 * when the hovered link is deleted, replaced, or changes target. Moving among
 * descendants of one label is de-duplicated.
 */
export function defineWikilinkHoverHandler(onHoverChange: WikilinkHoverHandler): PlainExtension {
  return defineMarkHoverHandler<WikilinkHit>({
    key: wikilinkHoverKey,
    selector: '.md-wikilink-view-preview',
    findPayloadAt: findWikilinkAt,
    findPayloadForElement: findWikilinkForElement,
    isSamePayload: (previous, next) => previous.target === next.target,
    onHoverChange: (hit) => {
      onHoverChange(hit ? { ...hit.payload, element: hit.element } : undefined)
    },
  })
}
