import type { EditorView } from '@prosekit/pm/view'

export interface CaretCoords {
  left: number
  top: number
  right: number
  bottom: number
}

function isZeroRect(rect: CaretCoords): boolean {
  return rect.left === 0 && rect.top === 0 && rect.right === 0 && rect.bottom === 0
}

/**
 * `view.coordsAtPos` that returns undefined instead of throwing on an
 * out-of-range position or returning a zero rect. A position whose `side`
 * neighbor is hidden markdown syntax has no visible box on that side and
 * measures as a bogus zero rect.
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
  return isZeroRect(coords) ? undefined : coords
}
