import { getMarkRange, type PlainExtension } from '@prosekit/core'
import { PluginKey, type EditorState } from '@prosekit/pm/state'

import type { MdLinkTextAttrs } from './inline-marks.ts'
import { defineMarkClickHandler } from './mark-click.ts'
import type { MarkName } from './mark-names.ts'

const linkClickKey = new PluginKey('meowdown-link-click')

export interface LinkHit {
  from: number
  to: number
  href: string
}


// REVIEW: RENAME THIS FROM `linkAt` TO `findLinkAt`
/** The link covering `pos`, found via the `mdLinkText` mark. Exported for tests. */
export function linkAt(state: EditorState, pos: number): LinkHit | undefined {
  const $pos = state.doc.resolve(pos)
  if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return
  const range = getMarkRange($pos, 'mdLinkText' satisfies MarkName)
  if (!range) return
  return { from: range.from, to: range.to, href: (range.mark.attrs as MdLinkTextAttrs).href }
}

export interface LinkClickPayload {
  href: string
  event: MouseEvent
}

export type LinkClickHandler = (payload: LinkClickPayload) => void

export function defineLinkClickHandler(onClick: LinkClickHandler): PlainExtension {
  return defineMarkClickHandler({
    key: linkClickKey,
    selector: 'a', // REVIEW: this feels unsafe because we might have a lot of <a> elements in the editor. Maybe we should use a more specific selector? Perhaps update the markd spec?
    preventDefault: true,
    hitAt: (state, pos) => {
      const hit = linkAt(state, pos)
      return hit ? { from: hit.from, to: hit.to, payload: hit.href } : undefined
    },
    onClick: (href, event) => onClick({ href, event }),
  })
}
