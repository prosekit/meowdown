import type { PlainExtension } from '@prosekit/core'
import { PluginKey, type EditorState } from '@prosekit/pm/state'

import { getMarkRangeAt } from './get-mark-range-at.ts'
import { defineMarkClickHandler } from './mark-click.ts'

const tagClickKey = new PluginKey('meowdown-tag-click')

export interface TagHit {
  from: number
  to: number
  tag: string
}

/**
 * The tag covering `pos`, found via the `mdTag` run. The tag name is read from
 * the run's own text (the `mdTag` mark carries no attrs), with the leading `#`
 * stripped. Exported for tests.
 */
export function findTagAt(state: EditorState, pos: number): TagHit | undefined {
  const range = getMarkRangeAt(state, pos, 'mdTag')
  if (!range) return
  const text = state.doc.textBetween(range.from, range.to)
  const tag = text.startsWith('#') ? text.slice(1) : text
  return { from: range.from, to: range.to, tag }
}

export interface TagClickPayload {
  /** The tag name, without the leading `#`. */
  tag: string
  /** The originating click. Read modifier keys or position a popover from it. */
  event: MouseEvent
}

export type TagClickHandler = (payload: TagClickPayload) => void

export function defineTagClickHandler(onClick: TagClickHandler): PlainExtension {
  return defineMarkClickHandler<string>({
    key: tagClickKey,
    selector: '.md-tag',
    preventDefault: false,
    findPayloadAt: (state, pos) => findTagAt(state, pos)?.tag,
    onClick: (tag, event) => onClick({ tag, event }),
  })
}
