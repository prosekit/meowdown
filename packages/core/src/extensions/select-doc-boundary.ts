import { defineKeymap, isApple, type PlainExtension } from '@prosekit/core'
import { Selection, TextSelection, type Command } from '@prosekit/pm/state'

function selectDocBoundary(direction: -1 | 1, extend: boolean): Command {
  return (state, dispatch) => {
    const boundary = direction < 0 ? Selection.atStart(state.doc) : Selection.atEnd(state.doc)
    const selection = extend
      ? TextSelection.between(state.selection.$anchor, boundary.$head)
      : boundary
    if (!state.selection.eq(selection)) {
      dispatch?.(state.tr.setSelection(selection).scrollIntoView())
    }
    return true
  }
}

/**
 * Binds the macOS document-boundary motions (`Meta-ArrowUp` / `Meta-ArrowDown`
 * move the caret to the document start / end; the Shift variants extend the
 * selection there). Bound explicitly instead of relying on the browser's
 * native handling: WebKit gives up the native move when the document starts
 * with a `contenteditable=false` element (a list marker or checkbox), and
 * prosemirror-view rolls a native move to the document start back within
 * 200ms of a focus event.
 */
export function defineSelectDocBoundary(): PlainExtension {
  return defineKeymap(
    isApple
      ? {
          'Meta-ArrowUp': selectDocBoundary(-1, false),
          'Meta-ArrowDown': selectDocBoundary(1, false),
          'Shift-Meta-ArrowUp': selectDocBoundary(-1, true),
          'Shift-Meta-ArrowDown': selectDocBoundary(1, true),
        }
      : {},
  )
}
