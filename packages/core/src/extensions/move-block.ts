import { defineKeymap, isNodeSelection, type PlainExtension } from '@prosekit/core'
import { moveList } from '@prosekit/extensions/list'
import { NodeSelection, TextSelection, type Command, type EditorState } from '@prosekit/pm/state'

import { isSelectionInTableCell } from './table.ts'

export type MoveBlockDirection = 'up' | 'down'

/**
 * The index of the top-level block holding the whole selection, or null when
 * the selection spans several top-level blocks or floats between them (a gap
 * cursor or a select-all).
 */
function getTopLevelIndex(state: EditorState): number | null {
  const { selection } = state
  const { $from, $to } = selection
  if (isNodeSelection(selection) && $from.depth === 0) {
    return $from.index(0)
  }
  if ($from.depth > 0 && $to.depth > 0 && $from.index(0) === $to.index(0)) {
    return $from.index(0)
  }
  return null
}

/**
 * Swaps the top-level block holding the selection with its previous or next
 * sibling, keeping the selection inside the moved block. Inside a table cell
 * it does nothing: rows have their own structure, and a cell's text should
 * not drag the whole table around.
 */
export function swapTopLevelBlock(direction: MoveBlockDirection): Command {
  return (state, dispatch) => {
    if (isSelectionInTableCell(state)) {
      return false
    }

    const index = getTopLevelIndex(state)
    if (index === null) {
      return false
    }

    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= state.doc.childCount) {
      return false
    }

    if (dispatch) {
      const { selection } = state
      const first = Math.min(index, target)
      const start = selection.$from.posAtIndex(first, 0)
      const a = state.doc.child(first)
      const b = state.doc.child(first + 1)

      const tr = state.tr.replaceWith(start, start + a.nodeSize + b.nodeSize, [b, a])

      // The moved block keeps its content, so the selection transplants by the
      // size of the block it jumped over.
      const delta = direction === 'up' ? -a.nodeSize : b.nodeSize
      const next = isNodeSelection(selection)
        ? NodeSelection.create(tr.doc, selection.from + delta)
        : TextSelection.create(tr.doc, selection.anchor + delta, selection.head + delta)
      tr.setSelection(next)

      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

/**
 * Moves the list item under the selection (with its nested children) up or
 * down; outside a list, moves the whole top-level block instead, so the
 * shortcut behaves uniformly across the document.
 */
function moveBlock(direction: MoveBlockDirection): Command {
  return (state, dispatch, view) => {
    return (
      moveList(direction)(state, dispatch, view) ||
      swapTopLevelBlock(direction)(state, dispatch, view)
    )
  }
}

/**
 * Binds `Alt-ArrowUp` / `Alt-ArrowDown` to move the list item or block under
 * the selection. Alt-arrow combos produce no printable character, so they are
 * safe on non-US layouts.
 */
export function defineMoveBlock(): PlainExtension {
  return defineKeymap({
    'Alt-ArrowUp': moveBlock('up'),
    'Alt-ArrowDown': moveBlock('down'),
  })
}
