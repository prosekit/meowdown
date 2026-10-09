import { Priority, defineKeymap, withPriority, type PlainExtension } from '@prosekit/core'
import { Selection, type Command, type EditorState } from '@prosekit/pm/state'

import { isNodeOfType } from './node-names.ts'

/**
 * Claim Backspace only when the selection is an empty caret in an empty
 * paragraph that is the document's first block and has a block after it.
 * Delete that paragraph and leave the following block as it is.
 */
const deleteEmptyFirstBlock: Command = (state, dispatch) => {
  const { $from, empty } = state.selection
  // Only the document's first block, and only when that block is a paragraph.
  if (!empty || $from.depth !== 1 || $from.index(0) !== 0) {
    return false
  }
  const block = $from.parent
  if (!isNodeOfType(block, 'paragraph') || block.content.size > 0) {
    return false
  }
  // The only block in the document has nothing to move up.
  if (state.doc.childCount < 2) {
    return false
  }
  if (dispatch) {
    const tr = state.tr.delete(0, block.nodeSize)
    // The caret lands at the start of the new first block, or selects it when
    // it holds no caret position (a horizontal rule).
    tr.setSelection(Selection.atStart(tr.doc))
    dispatch(tr.scrollIntoView())
  }
  return true
}

/**
 * Nothing sits before the document's first block, so Backspace in an empty
 * first paragraph has nothing to join and does nothing. When this extension is
 * applied, that Backspace deletes the empty paragraph instead, and the rest of
 * the document moves up one line.
 */
export function defineBackspaceEmptyFirstBlock(
  enabled?: (state: EditorState) => boolean,
): PlainExtension {
  // Runs after every other Backspace handler, the base keymap included.
  return withPriority(
    defineKeymap({
      Backspace: (state, dispatch) => {
        return (!enabled || enabled(state)) && deleteEmptyFirstBlock(state, dispatch)
      },
    }),
    Priority.lowest,
  )
}
