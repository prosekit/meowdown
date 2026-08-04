import type { PlainExtension } from '@prosekit/core'
import { PluginKey } from '@prosekit/pm/state'

import { getLinkUnitAt } from './get-link-unit-at.ts'
import { defineMarkClickHandler } from './mark-click.ts'

const linkClickKey = new PluginKey('meowdown-link-click')

export interface LinkClickPayload {
  href: string
  /**
   * The originating click, or the `Enter`/`Mod-Enter` key press that followed the link.
   */
  event: MouseEvent | KeyboardEvent
}

export type LinkClickHandler = (payload: LinkClickPayload) => void

export interface LinkCopyPayload {
  href: string
}

export type LinkCopyHandler = (payload: LinkCopyPayload) => void

/**
 * Call `onClick` when the user clicks a rendered Markdown link
 * (`[text](url)`), or presses `Mod-Enter` with the caret on one. The `event`
 * is the originating `MouseEvent` or `KeyboardEvent`.
 */
export function defineLinkClickHandler(onClick: LinkClickHandler): PlainExtension {
  return defineMarkClickHandler<string>({
    key: linkClickKey,
    selector: '.md-link',
    preventDefault: true,
    findPayloadAt: (state, pos) => getLinkUnitAt(state, pos)?.href,
    onClick: (href, event) => onClick({ href, event }),
  })
}
