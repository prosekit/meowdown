import { getMarkRange, type MarkRange } from '@prosekit/core'
import type { Attrs } from '@prosekit/pm/model'
import type { EditorState } from '@prosekit/pm/state'

import type { MarkName } from './mark-names.ts'

/**
 * Returns the resolved position, or `undefined` when it falls outside the
 * document or in a place that carries no inline marks: marks describe inline
 * syntax in regular textblocks, never in code blocks.
 */
function resolvePosition(state: EditorState, pos: number) {
  const size = state.doc.content.size
  if (pos < 0 || pos > size) return
  const $pos = state.doc.resolve(pos)
  if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return
  return $pos
}

/**
 * Returns the run of the first listed mark covering `pos`, or `undefined` when
 * none covers it. `attrs` narrows the match to marks whose attributes contain
 * it, which is how a caller picks one level out of a nested stack of the same
 * mark.
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

/**
 * Returns the run ending exactly at `pos`, the one immediately to its left.
 * Probes from inside the left neighbour (`pos - 1`): probing `pos` itself
 * cannot see that run when another run starts exactly there, because
 * `getMarkRange` prefers the child to the right.
 */
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

/**
 * Returns the run starting exactly at `pos`, the one immediately to its right.
 * Checks the edge once per mark name: the first name to return any run may be
 * a mark of another name ending at `pos`, shadowing the one that starts there.
 */
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

/**
 * Returns the run strictly containing `pos`, so the characters on both sides
 * of `pos` carry the mark. A run that only touches `pos` with one of its edges
 * does not count.
 */
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
