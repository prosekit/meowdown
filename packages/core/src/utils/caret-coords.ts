import type { EditorView } from '@prosekit/pm/view'

export interface CaretCoords {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * A dimensionless point: the fallback measurement of a hidden (font-size: 0)
 * syntax run. A real caret rect always has line height, and a block-context
 * line always has width. WebKit reports the point at the origin, Blink and
 * Gecko at the run's baseline.
 */
function isPointRect(rect: CaretCoords): boolean {
  return rect.left === rect.right && rect.top === rect.bottom
}

/**
 * `view.coordsAtPos` that returns undefined instead of throwing on an
 * out-of-range position or returning a point rect. A position whose `side`
 * neighbor is hidden markdown syntax has no visible box on that side and
 * measures as a bogus dimensionless point.
 */
export function tryCoordsAtPos(
  view: EditorView,
  pos: number,
  side: -1 | 1,
): CaretCoords | undefined {
  if (pos < 0 || pos > view.state.doc.content.size) return undefined
  let coords: CaretCoords
  try {
    coords = view.coordsAtPos(pos, side)
  } catch {
    return undefined
  }
  return isPointRect(coords) ? undefined : coords
}
