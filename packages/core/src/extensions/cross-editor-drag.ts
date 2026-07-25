import { definePlugin, isApple, Priority, withPriority, type PlainExtension } from '@prosekit/core'
import type { ViewDragging } from '@prosekit/extensions/drop-indicator'
import type { Slice } from '@prosekit/pm/model'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

// Every mounted meowdown view on the page. A drag that starts in one of them
// and lands in another one moves content between two documents; ProseMirror's
// own move handling only ever covers a single view.
const mountedViews = new Set<EditorView>()

function findDragSource(target: EditorView): EditorView | undefined {
  for (const view of mountedViews) {
    if (view !== target && !view.isDestroyed && view.editable && view.dragging) {
      return view
    }
  }
}

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

function handleCrossEditorDrop(
  target: EditorView,
  event: DragEvent,
  slice: Slice,
  move: boolean,
): boolean {
  // `move` is true only when the drag started in this same view, where
  // ProseMirror removes the dragged content itself.
  if (move || slice.size === 0) return false

  const source = findDragSource(target)
  if (!source) return false

  const dragging = source.dragging
  if (!dragging) return false

  const shouldCopy = isApple ? event.altKey : event.ctrlKey
  if (shouldCopy) return false

  // Claim the drag, so a second drop cannot delete the same block twice.
  source.dragging = null

  // The insertion happens later in this same drop event, either in the drop
  // indicator plugin (at the position the indicator line showed) or in
  // ProseMirror itself. A transaction without steps keeps the same doc object,
  // so an unchanged reference means nothing landed and the source block stays.
  const docBeforeDrop = target.state.doc
  queueMicrotask(() => {
    if (source.isDestroyed || target.isDestroyed) return
    if (target.state.doc === docBeforeDrop) return
    deleteDraggedContent(source, dragging)
  })

  // Never consume the drop: inserting is still someone else's job.
  return false
}

function createCrossEditorDragPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('meowdown-cross-editor-drag'),
    view: (view) => {
      mountedViews.add(view)
      return {
        destroy: () => {
          mountedViews.delete(view)
        },
      }
    },
    props: {
      handleDrop: handleCrossEditorDrop,
    },
  })
}

/**
 * Dragging a block from one meowdown editor into another one on the same page
 * moves it: the block leaves the source document once it lands in the target.
 * Hold Alt (Ctrl on Windows and Linux) to copy instead.
 */
export function defineCrossEditorDrag(): PlainExtension {
  // High priority so this runs before the drop indicator plugin, which
  // consumes the drop and would keep any later `handleDrop` from seeing it.
  return withPriority(definePlugin(createCrossEditorDragPlugin()), Priority.high)
}
