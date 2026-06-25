import {
  definePlugin,
  isNodeSelection,
  isTextSelection,
  Priority,
  withPriority,
  type PlainExtension,
} from '@prosekit/core'
import { Plugin, PluginKey, Selection, type EditorState } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

const exitBoundaryKey = new PluginKey('meowdown-exit-boundary')

export interface ExitBoundaryOptions {
  direction: 'up' | 'down'
  event: KeyboardEvent
}

export type ExitBoundaryHandler = (options: ExitBoundaryOptions) => boolean | void

// Ported from prosemirror-view's `moveSelectionBlock`
// https://code.haverbeke.berlin/prosemirror/prosemirror-view/src/tag/1.41.8/src/capturekeys.ts#L7-L12
//
// Whether moving in `direction` lands the selection on another block (a sibling
// textblock, a node selection, ...). False only when nothing is reachable.
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

function canMoveVertically(view: EditorView, direction: 1 | -1): boolean {
  const { state } = view
  const { selection } = state

  if (isTextSelection(selection)) {
    if (!selection.empty) return true
    if (!view.endOfTextblock(direction < 0 ? 'up' : 'down')) return true
    return canMoveBlockwise(state, direction)
  }

  if (isNodeSelection(selection)) {
    if (!view.endOfTextblock(direction < 0 ? 'up' : 'down')) return true
    return canMoveBlockwise(state, direction)
  }

  return true
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

export function defineExitBoundaryHandler(onExitBoundary: ExitBoundaryHandler): PlainExtension {
  return withPriority(definePlugin(createExitBoundaryPlugin(onExitBoundary)), Priority.low)
}
