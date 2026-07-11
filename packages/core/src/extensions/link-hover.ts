import type { PlainExtension } from '@prosekit/core'

import { getLinkUnitAt, type LinkUnit } from './get-link-unit-at.ts'
import { defineMarkHoverHandler, type MarkHoverHit } from './mark-hover.ts'

export type LinkHoverHandler = (hit: MarkHoverHit<LinkUnit> | undefined) => void

export function defineLinkHoverHandler(onHoverChange: LinkHoverHandler): PlainExtension {
  return defineMarkHoverHandler<LinkUnit>({
    selector: '.md-link',
    findPayloadAt: (state, pos): LinkUnit | undefined => {
      return getLinkUnitAt(state, pos)
    },
    isSamePayload: (previous, next) => {
      return previous.href === next.href && previous.title === next.title
    },
    onHoverChange,
  })
}
