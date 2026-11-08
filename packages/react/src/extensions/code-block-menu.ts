import { isNodeOfType } from '@meowdown/core'
import { defineKeymap, type PlainExtension } from '@prosekit/core'
import type { Command } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

interface CodeBlockMenuOpener {
  getPos: () => number | undefined
  open: () => void
}

const openersByView = new WeakMap<EditorView, Set<CodeBlockMenuOpener>>()

/**
 * Registers the menu of one code block node view, so that `Mod-/` can open it.
 * Returns a function that removes the registration.
 */
export function registerCodeBlockMenu(view: EditorView, opener: CodeBlockMenuOpener): VoidFunction {
  let openers = openersByView.get(view)
  if (openers == null) {
    openers = new Set()
    openersByView.set(view, openers)
  }
  openers.add(opener)
  return () => {
    openers.delete(opener)
  }
}

const openCodeBlockMenu: Command = (state, dispatch, view) => {
  const { $from, $to } = state.selection
  if (!isNodeOfType($from.parent, 'codeBlock') || !$from.sameParent($to) || view == null) {
    return false
  }
  const pos = $from.before()
  const openers = openersByView.get(view)
  if (openers == null) return false
  for (const opener of openers) {
    if (opener.getPos() === pos) {
      if (dispatch) opener.open()
      return true
    }
  }
  return false
}

/**
 * Opens the menu of the code block that holds the selection with `Mod-/`.
 */
export function defineCodeBlockMenuKeymap(): PlainExtension {
  return defineKeymap({ 'Mod-/': openCodeBlockMenu })
}
