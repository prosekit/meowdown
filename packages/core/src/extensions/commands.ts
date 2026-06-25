import { defineCommands } from '@prosekit/core'
import type { ResolvedPos } from '@prosekit/pm/model'
import { TextSelection, type Command } from '@prosekit/pm/state'

export function selectText(anchor: number, head?: number): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const selection = TextSelection.create(state.doc, anchor, head)
      const tr = state.tr.setSelection(selection)
      dispatch(tr)
    }
    return true
  }
}

export function selectTextBetween(
  $anchor: ResolvedPos,
  $head: ResolvedPos,
  bias?: number,
): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const selection = TextSelection.between($anchor, $head, bias)
      const tr = state.tr.setSelection(selection)
      dispatch(tr)
    }
    return true
  }
}

export function defineEditorCommands() {
  return defineCommands({
    selectText,
    selectTextBetween,
  })
}
