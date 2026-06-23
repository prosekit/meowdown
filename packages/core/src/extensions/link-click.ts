import type { PlainExtension } from '@prosekit/core'
import { PluginKey, type EditorState } from '@prosekit/pm/state'

import { getMarkRangeAt } from './get-mark-range-at.ts'
import type { MdLinkTextAttrs } from './inline-marks.ts'
import { defineMarkClickHandler } from './mark-click.ts'

const linkClickKey = new PluginKey('meowdown-link-click')

export interface LinkHit {
  from: number
  to: number
  href: string
}

/** The link covering `pos`, found via the `mdLinkText` mark. Exported for tests. */
export function findLinkAt(state: EditorState, pos: number): LinkHit | undefined {
  const range = getMarkRangeAt(state, pos, 'mdLinkText')
  if (!range) return
  return { from: range.from, to: range.to, href: (range.mark.attrs as MdLinkTextAttrs).href }
}

export interface LinkClickPayload {
  href: string
  event: MouseEvent
}

export type LinkClickHandler = (payload: LinkClickPayload) => void

export function defineLinkClickHandler(onClick: LinkClickHandler): PlainExtension {
  return defineMarkClickHandler<string>({
    key: linkClickKey,
    selector: '.md-link',
    preventDefault: true,
    findPayloadAt: (state, pos) => findLinkAt(state, pos)?.href,
    onClick: (href, event) => onClick({ href, event }),
  })
}
