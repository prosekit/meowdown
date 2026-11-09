import { isElementLike } from '@ocavue/utils'
import type { EditorView } from '@prosekit/pm/view'

/**
 * The atom mark view (an image, file, or wiki link) whose source holds
 * `insidePos`, a position inside the unit rather than on its edges.
 */
export function getAtomViewAt(view: EditorView, insidePos: number): Element | undefined {
  const { node } = view.domAtPos(insidePos, 0)
  const element = isElementLike(node) ? node : node.parentElement
  return element?.closest('.md-atom-view') ?? undefined
}

/**
 * The document position of the source of the atom mark view that holds
 * `element`. Read it from the hidden content holder, not from an event's
 * position: an event on the non-editable preview lands on the unit boundary,
 * where a mark lookup would pick the next adjacent unit.
 */
export function getAtomViewSourcePos(view: EditorView, element: Element): number | undefined {
  const content = element.closest('.md-atom-view')?.querySelector('.md-atom-view-content')
  return content ? view.posAtDOM(content, 0) : undefined
}
