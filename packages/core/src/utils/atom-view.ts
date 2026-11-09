import { isElementLike } from '@ocavue/utils'
import type { EditorView } from '@prosekit/pm/view'

import {
  ATOM_VIEW_CLASS,
  ATOM_VIEW_CONTENT_CLASS,
  ATOM_VIEW_PREVIEW_CLASS,
} from '../class-names.ts'

/**
 * The atom mark view (an image, file, or wiki link) whose source holds
 * `insidePos`, a position inside the unit rather than on its edges.
 */
export function findAtomViewAt(view: EditorView, insidePos: number): Element | undefined | null {
  const { node } = view.domAtPos(insidePos, 0)
  const element = isElementLike(node) ? node : node.parentElement
  return element?.closest(`.${ATOM_VIEW_CLASS}`)
}

/**
 * The rendered preview of the atom mark view whose source holds `insidePos`.
 */
export function findAtomPreviewElement(
  view: EditorView,
  insidePos: number,
): Element | undefined | null {
  return findAtomViewAt(view, insidePos)?.querySelector(`.${ATOM_VIEW_PREVIEW_CLASS}`)
}

/**
 * The document position of the source of the atom mark view that holds
 * `element`. Read it from the hidden content holder, not from an event's
 * position: an event on the non-editable preview lands on the unit boundary,
 * where a mark lookup would pick the next adjacent unit.
 */
export function getAtomViewSourcePos(view: EditorView, element: Element): number | undefined {
  const content = element
    .closest(`.${ATOM_VIEW_CLASS}`)
    ?.querySelector(`.${ATOM_VIEW_CONTENT_CLASS}`)
  return content ? view.posAtDOM(content, 0) : undefined
}
