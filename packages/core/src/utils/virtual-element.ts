import type { VirtualElement } from '@floating-ui/dom'
import type { EditorView } from '@prosekit/pm/view'

import { findAtomEdgeRect } from '../extensions/caret-rect.ts'
import { getHiddenRunAfter, getHiddenRunBefore } from '../extensions/hidden-run.ts'

import { tryCoordsAtPos, type CaretCoords } from './caret-coords.ts'
import type { PositionRange } from './range.ts'

export type { VirtualElement }

// A range edge against a hidden syntax run has no glyph of its own; the
// nearest visible glyph past the run's far end carries the line geometry.
// `side` points into the range, like `coordsAtPos`.
function tryHiddenRunCoords(view: EditorView, pos: number, side: -1 | 1): CaretCoords | undefined {
  if (side === 1) {
    const run = getHiddenRunAfter(view.state, pos)
    return run && tryCoordsAtPos(view, run.to, side)
  } else {
    const run = getHiddenRunBefore(view.state, pos)
    return run && tryCoordsAtPos(view, run.from, -1)
  }
}

/**
 * Returns a Floating-UI virtual element tracking a document range.
 *
 * Positioning libraries re-measure asynchronously (resize observers, animation
 * frames), so a measurement can fire after the view is destroyed or the range
 * no longer resolves; those return the last known rect instead of throwing.
 */
export function getVirtualElementFromRange(view: EditorView, range: PositionRange): VirtualElement {
  let lastRect = new DOMRect(0, 0, 0, 0)
  const getBoundingClientRect = (): DOMRect => {
    if (view.isDestroyed) return lastRect
    // Bias both measurements into the range's own content. Measured outward
    // (the default `side`), an edge that sits against hidden markdown syntax
    // at a block boundary has no visible neighbor and yields a bogus
    // zero rect, anchoring the popover at the viewport corner. An edge
    // touching an atom unit (image, wikilink, file) has no measurable glyph on
    // either side; its preview element is the visible geometry. An edge
    // against plain hidden syntax anchors on the visible glyph past the run.
    const start =
      tryCoordsAtPos(view, range.from, 1) ??
      findAtomEdgeRect(view, range.from, 1) ??
      tryHiddenRunCoords(view, range.from, 1) ??
      tryCoordsAtPos(view, range.from, -1)
    if (start == null) return lastRect
    const end =
      tryCoordsAtPos(view, range.to, -1) ??
      findAtomEdgeRect(view, range.to, -1) ??
      tryHiddenRunCoords(view, range.to, -1) ??
      tryCoordsAtPos(view, range.to, 1)
    if (end == null) return lastRect
    const left = Math.min(start.left, end.left)
    const right = Math.max(start.right, end.right)
    const top = Math.min(start.top, end.top)
    const bottom = Math.max(start.bottom, end.bottom)
    lastRect = new DOMRect(left, top, right - left, bottom - top)
    return lastRect
  }
  return {
    getBoundingClientRect,
    getClientRects: () => [getBoundingClientRect()],
  }
}
