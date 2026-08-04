import { Fragment, Slice } from '@prosekit/pm/model'
import { NodeSelection, TextSelection } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

/**
 * Serialize `slice` onto a real `DataTransfer` and leave `view.dragging` on the
 * source view, the way `handlers.dragstart` does. Returns the transfer for
 * `dropAt`.
 */
function startDrag(view: EditorView, slice: Slice, node?: NodeSelection): DataTransfer {
  const serialized = view.serializeForClipboard(slice)

  const dataTransfer = new DataTransfer()
  dataTransfer.setData('text/html', serialized.dom.innerHTML)
  dataTransfer.setData('text/plain', serialized.text)
  dataTransfer.effectAllowed = 'copyMove'

  // Not annotated: `EditorView['dragging']` omits `node`, and an inline object
  // literal would trip the excess property check.
  const dragging = { slice: serialized.slice, move: true, node }
  view.dragging = dragging

  return dataTransfer
}

/**
 * Drag the block at `pos`, the way ProseKit's block handle does.
 */
export function startBlockDrag(view: EditorView, pos: number): DataTransfer {
  const node = view.state.doc.nodeAt(pos)
  if (!node) throw new Error(`[meowdown] no node at position ${pos}`)

  return startDrag(
    view,
    new Slice(Fragment.from(node), 0, 0),
    NodeSelection.create(view.state.doc, pos),
  )
}

/**
 * Drag the text between `from` and `to`, which carries no `dragging.node`.
 */
export function startTextDrag(view: EditorView, from: number, to: number): DataTransfer {
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)))
  return startDrag(view, view.state.selection.content())
}

/**
 * Dispatch a `drop` carrying `dataTransfer` at the document position `pos`.
 */
export function dropAt(
  view: EditorView,
  dataTransfer: DataTransfer,
  pos: number,
  init: DragEventInit = {},
): DragEvent {
  const coords = view.coordsAtPos(pos)
  const event = new DragEvent('drop', {
    dataTransfer,
    clientX: coords.left,
    clientY: (coords.top + coords.bottom) / 2,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  view.dom.dispatchEvent(event)
  return event
}
