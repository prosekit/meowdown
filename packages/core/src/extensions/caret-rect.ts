import type { EditorView } from '@prosekit/pm/view'

import { tryCoordsAtPos, type CaretCoords } from '../utils/caret-coords.ts'
import { isAfterLineBreak } from '../utils/line-break.ts'

import { getHiddenRunAfter, getHiddenRunBefore } from './hidden-run.ts'
import { ATOM_SOURCE_MARK_NAMES } from './mark-names.ts'
import { getMarkRangeAt } from './mark-range.ts'

export interface CaretRect {
  left: number
  top: number
  height: number
}

// The collapsed native selection range. The browser resolves fonts,
// baselines, and bidi for us.
export function findNativeCaretRect(view: EditorView): CaretRect | undefined {
  const selection = view.dom.ownerDocument.getSelection()
  if (selection == null || selection.rangeCount === 0) return undefined
  if (!view.dom.contains(selection.anchorNode)) return undefined
  const range = selection.getRangeAt(0).cloneRange()
  range.collapse(true)
  return findLastRangeRect(range)
}

// The last line fragment of a collapsed range. At a line wrap Chrome reports
// two rects and the last one is the start of the next visual line, which is
// where the caret belongs.
function findLastRangeRect(range: Range): CaretRect | undefined {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.height > 0)
  const rect = rects[rects.length - 1]
  if (rect == null) return undefined
  return { left: rect.left, top: rect.top, height: rect.height }
}

// coordsAtPos with the side biased toward a visible neighbor. Every position
// touching a hidden run shares one visual point (the run has zero width), so
// when the head itself measures flat we probe from the run's far ends instead.
export function findCoordsCaretRect(view: EditorView): CaretRect | undefined {
  const state = view.state
  const { head, $head } = state.selection
  const runBefore = getHiddenRunBefore(state, head)
  const runAfter = getHiddenRunAfter(state, head)
  // A position right after a literal newline starts a soft line. Every engine
  // measures the collapsed native range there against the line before: Gecko
  // reports that line's end, WebKit one character cell past it, Blink no rect at
  // all.
  const afterLineBreak = isAfterLineBreak($head)
  // Safari 26.5.2 and earlier report a spurious previous-line rect here and
  // coordsAtPos picks it, so a caret at a soft line start must measure
  // strictly below the previous line: the newline's own rect (side -1). See
  // https://github.com/prosekit/meowdown/issues/530 and
  // https://github.com/issueset/repro-pm-coords-after-newline for details.
  const previousLineTop = afterLineBreak ? tryCoordsAtPos(view, head, -1)?.top : undefined
  // `beforeSide` picks which neighbor to measure: true the character before
  // the position, false the character after it. At a soft line start only the
  // after side is meaningful: the before side would measure the newline,
  // which is the previous-line baseline itself.
  const probes: [pos: number, beforeSide: boolean][] = afterLineBreak
    ? [[head, false]]
    : [
        [head, runBefore == null],
        [head, runBefore != null],
      ]
  if (runBefore != null) probes.push([runBefore.from, true])
  if (runAfter != null) probes.push([runAfter.to, false])
  for (const [pos, beforeSide] of probes) {
    const coords = tryCoordsAtPos(view, pos, beforeSide ? -1 : 1)
    if (coords == null || coords.bottom <= coords.top) continue
    if (pos === head && previousLineTop != null && coords.top <= previousLineTop) continue
    return { left: coords.left, top: coords.top, height: coords.bottom - coords.top }
  }
  if (previousLineTop != null) {
    const collapsed = findCollapsedRangeRect(view, head)
    if (collapsed != null && collapsed.top > previousLineTop) return collapsed
  }
  return undefined
}

// The collapsed DOM range at the caret's own position: old WebKit measures it
// on the caret's line even where its char-range rects lie, Gecko measures it
// on the previous line (the caller's validation rejects that), and Blink
// returns no rect at all.
function findCollapsedRangeRect(view: EditorView, pos: number): CaretRect | undefined {
  try {
    const { node, offset } = view.domAtPos(pos, 0)
    const range = view.dom.ownerDocument.createRange()
    range.setStart(node, offset)
    range.collapse(true)
    return findLastRangeRect(range)
  } catch {
    return undefined
  }
}

// An atom mark view collapses its source text to a zero-size box
// (font-size: 0), so no position beside it has a box the other measurements
// can see. The preview element standing in for the source is the visible
// geometry; the caret sits flush against its outer edge. A preview wrapped
// across lines has one client rect per line fragment; the caret hugs the
// fragment at its own end, never the multi-line union box.
export function findAtomCaretRect(view: EditorView): CaretRect | undefined {
  const state = view.state
  const head = state.selection.head
  for (const markName of ATOM_SOURCE_MARK_NAMES) {
    const range = getMarkRangeAt(state, head, markName)
    if (range == null || (range.from !== head && range.to !== head)) continue
    const preview = findAtomPreviewElement(view, range.from + 1)
    if (preview == null) continue
    const fragments = Array.from(preview.getClientRects()).filter((rect) => rect.height > 0)
    if (fragments.length === 0) continue
    const atEnd = range.to === head
    const fragment = atEnd ? fragments[fragments.length - 1] : fragments[0]
    const left = atEnd ? fragment.right : fragment.left
    return { left, top: fragment.top, height: fragment.height }
  }
  return undefined
}

/**
 * The preview fragment rect for a range edge touching an atom unit: the
 * visible geometry standing in for source text that measures as nothing.
 * `side` points into the range: `1` for a start edge (first line fragment),
 * `-1` for an end edge (last line fragment).
 */
export function findAtomEdgeRect(
  view: EditorView,
  pos: number,
  side: -1 | 1,
): CaretCoords | undefined {
  const state = view.state
  for (const markName of ATOM_SOURCE_MARK_NAMES) {
    const range = getMarkRangeAt(state, pos, markName)
    if (range == null) continue
    const preview = findAtomPreviewElement(view, range.from + 1)
    if (preview == null) continue
    const fragments = Array.from(preview.getClientRects()).filter((rect) => rect.height > 0)
    if (fragments.length === 0) continue
    return side === 1 ? fragments[0] : fragments[fragments.length - 1]
  }
  return undefined
}

function findAtomPreviewElement(view: EditorView, insidePos: number): Element | undefined {
  const { node } = view.domAtPos(insidePos, 0)
  const element = node instanceof Element ? node : node.parentElement
  const preview = element?.closest('.md-atom-view')?.querySelector('.md-atom-view-preview')
  return preview ?? undefined
}

/**
 * The caret rect for scroll targeting: the head-anchored subset of the
 * geometry the virtual caret draws. Skips the native-selection measurement
 * (anchored at the selection start, not the head) and the cosmetic stretch.
 * Undefined when the head has no measurable geometry at all.
 */
export function measureCaretScrollRect(view: EditorView): CaretRect | undefined {
  return findCoordsCaretRect(view) ?? findAtomCaretRect(view)
}
