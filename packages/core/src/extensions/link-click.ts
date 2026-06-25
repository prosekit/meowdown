import type { PlainExtension } from '@prosekit/core'
import { PluginKey } from '@prosekit/pm/state'

import { getLinkUnitAt } from './get-link-unit-at.ts'
import { defineMarkClickHandler } from './mark-click.ts'

const linkClickKey = new PluginKey('meowdown-link-click')

export interface LinkClickPayload {
  href: string
  event: MouseEvent
}

export type LinkClickHandler = (payload: LinkClickPayload) => void

export interface LinkCopyPayload {
  href: string
}

export type LinkCopyHandler = (payload: LinkCopyPayload) => void

export function defineLinkClickHandler(onClick: LinkClickHandler): PlainExtension {
  return defineMarkClickHandler<string>({
    key: linkClickKey,
    selector: '.md-link',
    preventDefault: true,
    findPayloadAt: (state, pos) => getLinkUnitAt(state, pos)?.href,
    onClick: (href, event) => onClick({ href, event }),
  })
}
