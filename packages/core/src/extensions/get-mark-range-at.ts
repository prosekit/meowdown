import { getMarkRange, type MarkRange } from '@prosekit/core'
import type { Attrs } from '@prosekit/pm/model'
import type { EditorState } from '@prosekit/pm/state'

import type { MarkName } from './mark-names.ts'

/**
 * The `markName` run covering `pos`, or `undefined` when `pos` is not inside a
 * non-code textblock. Centralizes the guard the click finders share: marks only
 * carry inline syntax in regular textblocks, never in code blocks. `attrs`
 * narrows the match to marks whose attrs contain it, which is how callers pick
 * one `mdPack` level out of a nested unit's stack.
 */
export function getMarkRangeAt(
  state: EditorState,
  pos: number,
  markName: MarkName,
  attrs?: Attrs,
): MarkRange | undefined {
  const size = state.doc.content.size
  if (pos < 0 || pos > size) return
  const $pos = state.doc.resolve(pos)
  if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return
  return getMarkRange($pos, markName, attrs)
}
