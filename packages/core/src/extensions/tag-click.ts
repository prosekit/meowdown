import type { PlainExtension } from '@prosekit/core'
import { PluginKey, type EditorState } from '@prosekit/pm/state'

import { defineMarkClickHandler } from './mark-click.ts'
import { getMarkRangeAt } from './mark-range.ts'

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
  /**
   * The tag name, without the leading `#`.
   */
  tag: string
  /**
   * The originating click, or the `Enter`/`Mod-Enter` key press that followed the tag.
   * Read modifier keys or position a popover from it.
   */
  event: MouseEvent | KeyboardEvent
  /**
   * Whether the activation carried `⌘`/`Ctrl` beyond the gesture that
   * triggered it: a modifier click, or a modifier `Enter` press on a selected
   * atom unit (where plain `Enter` already follows). Always false for the
   * `Mod-Enter` caret follow, whose modifier is the trigger itself. Hosts
   * conventionally open a `mod` follow in a new window or pane.
   */
  mod: boolean
}

export type TagClickHandler = (payload: TagClickPayload) => void

/**
 * Call `onClick` when the user clicks a rendered `#tag`, or presses
 * `Mod-Enter` with the caret on one. The `tag` is read from the rendered text
 * without the leading `#`.
 */
export function defineTagClickHandler(onClick: TagClickHandler): PlainExtension {
  return defineMarkClickHandler<string>({
    key: tagClickKey,
    selector: '.md-tag',
    preventDefault: false,
    findPayloadAt: (state, pos) => findTagAt(state, pos)?.tag,
    onClick: (tag, event) => onClick({ tag, event, mod: event.metaKey || event.ctrlKey }),
  })
}
