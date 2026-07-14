import { getMarkType } from '@prosekit/core'
import type { Mark } from '@prosekit/pm/model'
import type { EditorState } from '@prosekit/pm/state'

import type { MarkName } from './mark-names.ts'

// The marks whose text hide mode renders at font-size 0. Mirrors the CSS rules
// in style.css and CLIPBOARD_STRIP_MARK_NAMES in mark-mode.ts. Atom sources
// (mdImage / mdWikilink / mdFile) are not here: defineAtomMarkNavigation owns
// them.
const HIDDEN_MARK_NAMES: ReadonlySet<MarkName> = new Set<MarkName>([
  'mdMark',
  'mdLinkUri',
  'mdLinkTitle',
])

export interface HiddenRun {
  from: number
  to: number
}

// Marks of the character occupying [pos, pos + 1), or undefined when that slot
// is not a text character (block boundary, inline atom node, end of block).
function getCharMarks(state: EditorState, pos: number): readonly Mark[] | undefined {
  if (pos < 0 || pos + 1 > state.doc.content.size) return undefined
  const $pos = state.doc.resolve(pos)
  const child = $pos.parent.maybeChild($pos.index())
  if (child == null || !child.isText) return undefined
  return child.marks
}

export function isHiddenChar(state: EditorState, pos: number): boolean {
  const marks = getCharMarks(state, pos)
  if (marks == null) return false
  return marks.some((mark) => HIDDEN_MARK_NAMES.has(mark.type.name as MarkName))
}

function isInsideNonCodeTextblock(state: EditorState, pos: number): boolean {
  if (pos < 0 || pos > state.doc.content.size) return false
  const $pos = state.doc.resolve(pos)
  return $pos.parent.isTextblock && !$pos.parent.type.spec.code
}

/** The maximal contiguous hidden run ending exactly at `pos`, or undefined. */
export function getHiddenRunBefore(state: EditorState, pos: number): HiddenRun | undefined {
  if (!isInsideNonCodeTextblock(state, pos)) return undefined
  const blockStart = state.doc.resolve(pos).start()
  let from = pos
  while (from > blockStart && isHiddenChar(state, from - 1)) from--
  return from < pos ? { from, to: pos } : undefined
}

/** The maximal contiguous hidden run starting exactly at `pos`, or undefined. */
export function getHiddenRunAfter(state: EditorState, pos: number): HiddenRun | undefined {
  if (!isInsideNonCodeTextblock(state, pos)) return undefined
  const blockEnd = state.doc.resolve(pos).end()
  let to = pos
  while (to < blockEnd && isHiddenChar(state, to)) to++
  return to > pos ? { from: pos, to } : undefined
}

// A position is a hidden-run interior (never a caret rest position in hide
// mode) when the characters on both sides are hidden.
export function isHiddenRunInterior(state: EditorState, pos: number): boolean {
  return isHiddenChar(state, pos - 1) && isHiddenChar(state, pos)
}

/** The full run around an interior position, or undefined for rest positions. */
export function getHiddenRunAround(state: EditorState, pos: number): HiddenRun | undefined {
  if (!isHiddenRunInterior(state, pos)) return undefined
  const before = getHiddenRunBefore(state, pos)
  if (before == null) return undefined
  const after = getHiddenRunAfter(state, pos)
  if (after == null) return undefined
  return { from: before.from, to: after.to }
}

function charHasMark(state: EditorState, pos: number, mark: Mark): boolean {
  const marks = getCharMarks(state, pos)
  return marks != null && mark.isInSet(marks)
}

// The range of the smallest mdPack unit containing the character at `charPos`.
// mdPack uses `excludes: ''`, so a nested unit's character carries up to two
// pack marks; expand each instance separately and keep the smallest.
export function getInnermostPackRangeAt(
  state: EditorState,
  charPos: number,
): HiddenRun | undefined {
  const marks = getCharMarks(state, charPos)
  if (marks == null) return undefined
  const packType = getMarkType(state.schema, 'mdPack' satisfies MarkName)
  const packs = marks.filter((mark) => mark.type === packType)
  if (packs.length === 0) return undefined
  const $pos = state.doc.resolve(charPos)
  const blockStart = $pos.start()
  const blockEnd = $pos.end()
  let innermost: HiddenRun | undefined
  for (const pack of packs) {
    let from = charPos
    while (from > blockStart && charHasMark(state, from - 1, pack)) from--
    let to = charPos + 1
    while (to < blockEnd && charHasMark(state, to, pack)) to++
    if (innermost == null || to - from < innermost.to - innermost.from) {
      innermost = { from, to }
    }
  }
  return innermost
}

function isPackOuterEdge(state: EditorState, run: HiddenRun, edge: 'from' | 'to'): boolean {
  const charPos = edge === 'from' ? run.from : run.to - 1
  const pack = getInnermostPackRangeAt(state, charPos)
  if (pack == null) return false
  return edge === 'from' ? pack.from === run.from : pack.to === run.to
}

// A pointer caret inside a run lands on the unit's outer edge (a click at a
// word's visible edge means "outside the unit"). A merged run between two
// adjacent units has no outer edge and falls back to the nearest end.
function getPointerEdge(state: EditorState, run: HiddenRun, pos: number): number {
  const fromIsOuter = isPackOuterEdge(state, run, 'from')
  const toIsOuter = isPackOuterEdge(state, run, 'to')
  if (fromIsOuter && !toIsOuter) return run.from
  if (toIsOuter && !fromIsOuter) return run.to
  return pos - run.from <= run.to - pos ? run.from : run.to
}

/**
 * The rest position for a caret that landed at `newPos`. `oldPos` supplies the
 * travel direction for keyboard motion; `isPointer` selects the click rules.
 */
export function getRestPosition(
  state: EditorState,
  oldPos: number,
  newPos: number,
  isPointer: boolean,
): number {
  if (!isInsideNonCodeTextblock(state, newPos)) return newPos
  const run = getHiddenRunAround(state, newPos)
  if (run != null) {
    if (!isPointer) return newPos >= oldPos ? run.to : run.from
    return getPointerEdge(state, run, newPos)
  }
  if (!isPointer) return newPos
  const runBefore = getHiddenRunBefore(state, newPos)
  if (runBefore != null && isPackOuterEdge(state, runBefore, 'from')) return runBefore.from
  const runAfter = getHiddenRunAfter(state, newPos)
  if (runAfter != null && isPackOuterEdge(state, runAfter, 'to')) return runAfter.to
  return newPos
}

export type CaretTail = 'left' | 'right'

// Typing affinity: the tail points to the side whose formatting a typed
// character would adopt, which is the opposite side of the hidden run.
export function getCaretTail(state: EditorState, pos: number): CaretTail | undefined {
  if (!isInsideNonCodeTextblock(state, pos)) return undefined
  const hiddenBefore = isHiddenChar(state, pos - 1)
  const hiddenAfter = isHiddenChar(state, pos)
  if (hiddenBefore === hiddenAfter) return undefined
  return hiddenAfter ? 'left' : 'right'
}

/**
 * The leading and trailing hidden runs of the innermost unit whose marker
 * character sits at `charPos`, trailing first so callers can delete them in
 * order without remapping. A fully hidden unit yields one run.
 */
export function getUnitMarkerRuns(state: EditorState, charPos: number): HiddenRun[] {
  const pack = getInnermostPackRangeAt(state, charPos)
  if (pack == null) return []
  const leading = getHiddenRunAfter(state, pack.from)
  const trailing = getHiddenRunBefore(state, pack.to)
  const runs: HiddenRun[] = []
  if (trailing != null) runs.push(trailing)
  if (leading != null && (trailing == null || leading.from !== trailing.from)) {
    runs.push(leading)
  }
  return runs
}
