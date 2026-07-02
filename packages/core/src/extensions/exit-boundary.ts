import {
  definePlugin,
  isAllSelection,
  isTextSelection,
  Priority,
  withPriority,
  type PlainExtension,
} from '@prosekit/core'
import { Plugin, PluginKey, Selection, type EditorState } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

const exitBoundaryKey = new PluginKey('meowdown-exit-boundary')

/** Payload for {@link ExitBoundaryHandler}. */
export interface ExitBoundaryOptions {
  /** The boundary the caret would leave: `up` at the document start, `down` at the end. */
  direction: 'up' | 'down'
  /** The originating arrow key press. */
  event: KeyboardEvent
}

/**
 * Called when an arrow key press would move the caret past the document
 * boundary. Return `false` to let the editor handle the key normally; any
 * other return value consumes it.
 */
export type ExitBoundaryHandler = (options: ExitBoundaryOptions) => boolean | void

// Ported from prosemirror-view's `moveSelectionBlock`
// https://code.haverbeke.berlin/prosemirror/prosemirror-view/src/tag/1.41.8/src/capturekeys.ts#L7-L12
//
// Whether moving in `direction` lands the selection on another block (a sibling
// textblock, a node selection, a gap cursor position, ...). False only when
// nothing is reachable.
function canMoveBlockwise(state: EditorState, direction: 1 | -1): boolean {
  const { $anchor, $head } = state.selection
  const $side = direction > 0 ? $anchor.max($head) : $anchor.min($head)
  const $start = !$side.parent.inlineContent
    ? $side
    : $side.depth
      ? state.doc.resolve(direction > 0 ? $side.after() : $side.before())
      : undefined
  return !!($start && Selection.findFrom($start, direction))
}

// Mirrors prosemirror-view's `selectVertically`
// https://code.haverbeke.berlin/prosemirror/prosemirror-view/src/tag/1.41.8/src/capturekeys.ts#L247
//
// Whether pressing an arrow in `direction` can still move the selection within
// the document. When it cannot, the caret is at the document boundary.
function canMoveVertically(view: EditorView, direction: 1 | -1): boolean {
  const { state } = view
  const { selection } = state

  // A non-empty text selection collapses toward `direction`, and a select-all
  // collapses to a document end. Either way the caret moves, so never a
  // boundary. (A gap cursor and a node selection fall through to the checks
  // below.)
  if (isTextSelection(selection) && !selection.empty) return true
  if (isAllSelection(selection)) return true

  // When the selection sits in inline content (a text cursor, or a selected
  // inline node), the caret can still reach another visual line of the same
  // textblock. `selectVertically` only consults `endOfTextblock` here, where
  // the parent holds inline content; a block node selection and a gap cursor
  // have no visual line, so they skip straight to the blockwise check.
  if (selection.$from.parent.inlineContent && !view.endOfTextblock(direction < 0 ? 'up' : 'down')) {
    return true
  }

  return canMoveBlockwise(state, direction)
}

function createExitBoundaryPlugin(onExitBoundary: ExitBoundaryHandler) {
  return new Plugin({
    key: exitBoundaryKey,
    props: {
      handleKeyDown: (view, event) => {
        if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
          return false
        }

        const dir = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : undefined
        if (!dir) return false

        if (canMoveVertically(view, dir)) return false
        const result = onExitBoundary({ direction: dir < 0 ? 'up' : 'down', event })
        if (result === false) return false
        return true
      },
    },
  })
}

/** Call `onExitBoundary` when an arrow key press would leave the document boundary. */
export function defineExitBoundaryHandler(onExitBoundary: ExitBoundaryHandler): PlainExtension {
  return withPriority(definePlugin(createExitBoundaryPlugin(onExitBoundary)), Priority.low)
}
