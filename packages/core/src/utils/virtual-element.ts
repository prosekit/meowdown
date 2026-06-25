import type { VirtualElement } from '@floating-ui/dom'
import type { EditorView } from '@prosekit/pm/view'

import type { PositionRange } from './range.ts'

export type { VirtualElement }

/**
 * Returns a Floating-UI virtual element tracking a document range.
 */
export function getVirtualElementFromRange(view: EditorView, range: PositionRange): VirtualElement {
  const getBoundingClientRect = (): DOMRect => {
    const start = view.coordsAtPos(range.from)
    const end = view.coordsAtPos(range.to)
    const left = Math.min(start.left, end.left)
    const right = Math.max(start.right, end.right)
    const top = Math.min(start.top, end.top)
    const bottom = Math.max(start.bottom, end.bottom)
    return new DOMRect(left, top, right - left, bottom - top)
  }
  return {
    getBoundingClientRect,
    getClientRects: () => [getBoundingClientRect()],
  }
}
