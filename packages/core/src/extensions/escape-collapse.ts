import { defineKeymap, Priority, withPriority, type PlainExtension } from '@prosekit/core'
import { TextSelection, type Command } from '@prosekit/pm/state'

/**
 * Collapses a non-empty selection to a caret at its head. Leaves an empty
 * selection alone so Escape can serve whoever binds it next.
 */
const collapseSelection: Command = (state, dispatch, view) => {
  const { selection } = state
  if (selection.empty) {
    return false
  }
  if (view?.composing) {
    return false
  }
  dispatch?.(state.tr.setSelection(TextSelection.near(selection.$head)))
  return true
}

/**
 * Binds `Escape` to collapse the selection, at low priority so an open menu
 * (autocomplete binds Escape at the highest priority) dismisses itself first.
 */
export function defineEscapeCollapse(): PlainExtension {
  return withPriority(defineKeymap({ Escape: collapseSelection }), Priority.low)
}
