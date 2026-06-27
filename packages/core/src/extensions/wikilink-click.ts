import type { PlainExtension } from '@prosekit/core'
import { PluginKey, type EditorState } from '@prosekit/pm/state'

import { getMarkRangeAt } from './get-mark-range-at.ts'
import type { MdWikilinkV2Attrs } from './inline-marks.ts'
import { defineMarkClickHandler } from './mark-click.ts'

const wikilinkClickKey = new PluginKey('meowdown-wikilink-click')

export interface WikilinkHit {
  from: number
  to: number
  target: string
}

/** Exported for tests. */
export function findWikilinkAt(state: EditorState, pos: number): WikilinkHit | undefined {
  console.log('DEBUG findWikilinkAt')
  const range = getMarkRangeAt(state, pos, 'mdWikilinkV2')
  if (!range) return
  const { target } = range.mark.attrs as MdWikilinkV2Attrs
  return { from: range.from, to: range.to, target }
}

export interface WikilinkClickPayload {
  target: string
  event: MouseEvent
}

export type WikilinkClickHandler = (payload: WikilinkClickPayload) => void

export function defineWikilinkClickHandler(onClick: WikilinkClickHandler): PlainExtension {
  return defineMarkClickHandler<string>({
    key: wikilinkClickKey,
    selector: '.md-wikilink-view-preview-v2',
    preventDefault: false,
    findPayloadAt: (state, pos) => findWikilinkAt(state, pos)?.target,
    onClick: (target, event) => onClick({ target, event }),
  })
}
