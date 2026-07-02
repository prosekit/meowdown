import type { VirtualElement } from '@floating-ui/dom'
import type { EditorView } from '@prosekit/pm/view'

import type { PositionRange } from './range.ts'

export type { VirtualElement }

/**
 * Returns a Floating-UI virtual element tracking a document range.
 *
 * Positioning libraries re-measure asynchronously (resize observers, animation
 * frames), so a measurement can fire after the view is destroyed or the range
 * no longer resolves — those return the last known rect instead of throwing.
 */
export function getVirtualElementFromRange(view: EditorView, range: PositionRange): VirtualElement {
  let lastRect = new DOMRect(0, 0, 0, 0)
  const getBoundingClientRect = (): DOMRect => {
    if (view.isDestroyed) return lastRect
    try {
      const start = view.coordsAtPos(range.from)
      const end = view.coordsAtPos(range.to)
      const left = Math.min(start.left, end.left)
      const right = Math.max(start.right, end.right)
      const top = Math.min(start.top, end.top)
      const bottom = Math.max(start.bottom, end.bottom)
      lastRect = new DOMRect(left, top, right - left, bottom - top)
    } catch {
      // Out-of-range position (e.g. the document shrank mid-measure).
    }
    return lastRect
  }
  return {
    getBoundingClientRect,
    getClientRects: () => [getBoundingClientRect()],
  }
}
