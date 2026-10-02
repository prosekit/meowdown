import { definePlugin, type PlainExtension } from '@prosekit/core'
import type { ViewDragging } from '@prosekit/extensions/drop-indicator'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

function deleteDraggedContent(view: EditorView, dragging: ViewDragging): void {
  const tr = view.state.tr
  if (dragging.node) {
    // `dragging.node` holds dragstart-time positions. If the doc changed
    // during the drag, deleting there would hit the wrong range; keep the
    // block and let the drop degrade to a copy.
    if (view.state.doc.nodeAt(dragging.node.from) !== dragging.node.node) return
    dragging.node.replace(tr)
  } else {
    // A text selection drag carries no `node`; the source selection is still
    // the dragged text.
    tr.deleteSelection()
  }
  if (!tr.docChanged) return
  view.dispatch(tr.setMeta('uiEvent', 'drop'))
}

/**
 * Remove the content that a finished drag moved out of `view`. `dropEffect` is
 * the value the drag source reads on `dragend`.
 *
 * @internal
 */
export function removeMovedContent(view: EditorView, dropEffect: string | undefined): void {
  // A drop inside this view has already cleared `dragging`: ProseMirror moves
  // the content itself there.
  const dragging: ViewDragging | null = view.dragging
  if (!dragging || !view.editable || dropEffect !== 'move') return

  view.dragging = null
  deleteDraggedContent(view, dragging)
}

function createCrossEditorDragPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('meowdown-cross-editor-drag'),
    view: (view) => {
      // The block handle lives outside `view.dom`, so its `dragend` never
      // reaches the view; listen on the document instead.
      const ownerDocument = view.dom.ownerDocument
      const handleDragEnd = (event: DragEvent) => {
        removeMovedContent(view, event.dataTransfer?.dropEffect)
      }
      ownerDocument.addEventListener('dragend', handleDragEnd)
      return {
        destroy: () => {
          ownerDocument.removeEventListener('dragend', handleDragEnd)
        },
      }
    },
  })
}

/**
 * Dragging content out of a meowdown editor moves it when the drop target
 * accepts a move: another meowdown editor on the same page, or one in another
 * window or tab. The content leaves the source document once the drag ends.
 * Hold Alt (Ctrl on Windows and Linux) to copy instead.
 */
export function defineCrossEditorDrag(): PlainExtension {
  return definePlugin(createCrossEditorDragPlugin())
}
