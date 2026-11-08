import { isNodeOfType } from '@meowdown/core'
import { defineKeymap, type PlainExtension } from '@prosekit/core'
import type { Command } from '@prosekit/pm/state'
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
