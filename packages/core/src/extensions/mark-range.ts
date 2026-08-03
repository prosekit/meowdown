import { getMarkRange, type MarkRange } from '@prosekit/core'
import type { Attrs } from '@prosekit/pm/model'
import type { EditorState } from '@prosekit/pm/state'

import type { MarkName } from './mark-names.ts'

function resolvePosition(state: EditorState, pos: number) {
  const size = state.doc.content.size
  if (pos < 0 || pos > size) return
  const $pos = state.doc.resolve(pos)
  if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return
  return $pos
}

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
  markName: MarkName | Array<MarkName>,
  attrs?: Attrs,
): MarkRange | undefined {
  const $pos = resolvePosition(state, pos)
  if (!$pos) return

  const markNames = Array.isArray(markName) ? markName : [markName]
  for (const name of markNames) {
    const range = getMarkRange($pos, name, attrs)
    if (range) return range
  }
}

// REVIEW: TODO: 1. use JSdoc style comments for all functions instead of // comments. Do not add @param in the JSDoc thought.
// REVIEW: TODO: 2. prefix the comments with a word "Returns" so that it is clear that the function returns something
// REVIEW: TODO: 3. update the comment text so that they're general utils. Do not mentions concert only exist in packages/core/src/extensions/atom-mark-navigation.ts file.
// REVIEW: TODO: 4. update packages/core/src/extensions/atom-mark-navigation.ts file to use the general utils exported here.

// The unit whose range ends exactly at `pos` (immediately left of the caret).
// Probes from inside the left neighbour (`pos - 1`): probing `pos` itself
// cannot see the unit when another atom run starts exactly at `pos`, because
// `getMarkRange` prefers the child to the right.
export function getMarkRangeBefore(
  state: EditorState,
  pos: number,
  markNames: MarkName[],
): MarkRange | undefined {
  const $pos = resolvePosition(state, pos)
  if (!$pos) return

  for (const name of markNames) {
    const range = getMarkRangeAt(state, pos - 1, name)
    if (range && range.to === pos) return range
  }
  return
}

// The unit whose range starts exactly at `pos` (immediately right of the caret).
// Checks the edge per mark name: the first name to return any range may be a
// unit of another type ending at `pos`, shadowing the one that starts there.
export function getMarkRangeAfter(
  state: EditorState,
  pos: number,
  markNames: MarkName[],
): MarkRange | undefined {
  const $pos = resolvePosition(state, pos)
  if (!$pos) return

  for (const name of markNames) {
    const range = getMarkRangeAt(state, pos, name)
    if (range && range.from === pos) return range
  }
  return
}

// The unit range strictly containing `pos`: the caret sits between two
// characters of one hidden source, where every write splits the unit.
export function getMarkRangeStrictlyAround(
  state: EditorState,
  pos: number,
  markNames: MarkName[],
): MarkRange | undefined {
  const $pos = resolvePosition(state, pos)
  if (!$pos) return

  for (const name of markNames) {
    const range = getMarkRangeAt(state, pos, name)
    if (range && range.from < pos && pos < range.to) return range
  }
  return
}
