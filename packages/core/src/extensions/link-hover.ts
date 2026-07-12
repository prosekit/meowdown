import type { PlainExtension } from '@prosekit/core'
import { PluginKey } from '@prosekit/pm/state'

import { getLinkUnitAt, type LinkUnit } from './get-link-unit-at.ts'
import { defineMarkHoverHandler, type MarkHoverHit } from './mark-hover.ts'

const linkHoverKey = new PluginKey('meowdown-link-hover')

export type LinkHoverHandler = (hit: MarkHoverHit<LinkUnit> | undefined) => void

export function defineLinkHoverHandler(onHoverChange: LinkHoverHandler): PlainExtension {
  return defineMarkHoverHandler<LinkUnit>({
    key: linkHoverKey,
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
