import { isNodeOfType } from '@meowdown/core'
import { defineKeymap, type PlainExtension } from '@prosekit/core'
import { TextSelection, type Command } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

// TODO: Only code blocks have a block menu today. Give every block a menu.

const caretMenuOpeners = new WeakMap<EditorView, VoidFunction>()

/**
 * Sets the function that opens the menu of the code block that holds the
 * caret, so that `Mod-/` can open it. Returns a function that clears it.
 */
export function setCaretCodeBlockMenu(view: EditorView, open: VoidFunction): VoidFunction {
  caretMenuOpeners.set(view, open)
  return () => {
    // The code block that receives the caret can set its opener before the
    // code block that loses the caret clears its own.
    if (caretMenuOpeners.get(view) === open) caretMenuOpeners.delete(view)
  }
}

const openCodeBlockMenu: Command = (state, dispatch, view) => {
  const { $from, $to } = state.selection
  if (!isNodeOfType($from.parent, 'codeBlock') || !$from.sameParent($to) || view == null) {
    return false
  }
  const open = caretMenuOpeners.get(view)
  if (open == null) return false
  if (dispatch) open()
  return true
}

/**
 * Opens the menu of the code block that holds the selection with `Mod-/`.
 */
export function defineCodeBlockMenuKeymap(): PlainExtension {
  return defineKeymap({ 'Mod-/': openCodeBlockMenu })
}

/**
 * Deletes the block at `pos` and puts the caret where it was. A block that is
 * the only child of its parent gives way to an empty default block (usually a
 * paragraph), since the parent cannot be left empty.
 */
export function deleteBlock(pos: number): Command {
  return (state, dispatch) => {
    const $pos = state.doc.resolve(pos)
    const node = $pos.nodeAfter
    if (!node) return false
    if (dispatch) {
      const end = pos + node.nodeSize
      const tr =
        $pos.parent.childCount === 1
          ? state.tr.replaceWith(
              pos,
              end,
              $pos.parent.type.contentMatch.defaultType?.createAndFill() ?? [],
            )
          : state.tr.delete(pos, end)
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), 1))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}
