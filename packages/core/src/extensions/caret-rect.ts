import type { EditorView } from '@prosekit/pm/view'

import { tryCoordsAtPos } from '../utils/caret-coords.ts'

import { ATOM_SOURCE_MARK_NAMES } from './atom-mark-navigation.ts'
import { getMarkRangeAt } from './get-mark-range-at.ts'
import { getHiddenRunAfter, getHiddenRunBefore } from './hidden-run.ts'

export interface CaretRect {
  left: number
  top: number
  height: number
}

// The collapsed native selection range. The browser resolves fonts,
// baselines, and bidi for us. At a line wrap Chrome reports two rects and the
// last one is the start of the next visual line, which is where the caret
// belongs.
export function findNativeCaretRect(view: EditorView): CaretRect | undefined {
  const selection = view.dom.ownerDocument.getSelection()
  if (selection == null || selection.rangeCount === 0) return undefined
  if (!view.dom.contains(selection.anchorNode)) return undefined
  const range = selection.getRangeAt(0).cloneRange()
  range.collapse(true)
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.height > 0)
  if (rects.length === 0) return undefined
  const rect = rects[rects.length - 1]
  return { left: rect.left, top: rect.top, height: rect.height }
}

// coordsAtPos with the side biased toward a visible neighbor. Every position
// touching a hidden run shares one visual point (the run has zero width), so
// when the head itself measures flat we probe from the run's far ends instead.
export function findCoordsCaretRect(view: EditorView): CaretRect | undefined {
  const state = view.state
  const head = state.selection.head
  const runBefore = getHiddenRunBefore(state, head)
  const runAfter = getHiddenRunAfter(state, head)
  const preferredBeforeSide: boolean = runBefore == null
  // `side` picks which neighbor to measure: -1 the character before the
  // position, 1 the character after it.
  const probes: [pos: number, beforeSide: boolean][] = [
    [head, preferredBeforeSide],
    [head, !preferredBeforeSide],
  ]
  if (runBefore != null) probes.push([runBefore.from, true])
  if (runAfter != null) probes.push([runAfter.to, false])
  for (const [pos, beforeSide] of probes) {
    const coords = tryCoordsAtPos(view, pos, beforeSide ? -1 : 1)
    if (coords != null && coords.bottom > coords.top) {
      return { left: coords.left, top: coords.top, height: coords.bottom - coords.top }
    }
  }
  return undefined
}

// An atom mark view collapses its source text to a zero-size box
// (font-size: 0), so no position beside it has a box the other measurements
// can see. The preview element standing in for the source is the visible
// geometry; the caret sits flush against its outer edge.
export function findAtomCaretRect(view: EditorView): CaretRect | undefined {
  const state = view.state
  const head = state.selection.head
  for (const markName of ATOM_SOURCE_MARK_NAMES) {
    const range = getMarkRangeAt(state, head, markName)
    if (range == null || (range.from !== head && range.to !== head)) continue
    const preview = findAtomPreviewElement(view, range.from + 1)
    if (preview == null) continue
    const rect = preview.getBoundingClientRect()
    if (rect.height === 0) continue
    const left = range.to === head ? rect.right : rect.left
    return { left, top: rect.top, height: rect.height }
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
