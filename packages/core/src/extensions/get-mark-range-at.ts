import { getMarkRange, type MarkRange } from '@prosekit/core'
import type { EditorState } from '@prosekit/pm/state'

import type { MarkName } from './mark-names.ts'

/**
 * The `markName` run covering `pos`, or `undefined` when `pos` is not inside a
 * non-code textblock. Centralizes the guard the click finders share: marks only
 * carry inline syntax in regular textblocks, never in code blocks.
 */
export function getMarkRangeAt(
  state: EditorState,
  pos: number,
  markName: MarkName,
): MarkRange | undefined {
  const $pos = state.doc.resolve(pos)
  if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return
  return getMarkRange($pos, markName)
}
