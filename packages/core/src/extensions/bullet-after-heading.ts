import {
  Priority,
  defineKeymap,
  getNodeType,
  withPriority,
  type PlainExtension,
} from '@prosekit/core'
import { TextSelection, type Command } from '@prosekit/pm/state'

/**
 * Claim Enter only when the selection is an empty caret at the very end of a
 * heading, starting a fresh empty bullet on the next line. Every other Enter
 * (mid-heading, in a paragraph, inside a list) returns false and falls through
 * to the editor's default handling.
 */
const bulletAfterHeadingOnEnter: Command = (state, dispatch) => {
  const { $from, empty } = state.selection
  if (!empty || $from.parent.type.name !== 'heading') {
    return false
  }
  // Only at the end of the heading's text; Enter elsewhere splits as usual.
  if ($from.parentOffset !== $from.parent.content.size) {
    return false
  }
  if (dispatch) {
    const listType = getNodeType(state.schema, 'list')
    const paragraphType = getNodeType(state.schema, 'paragraph')
    const bullet = listType.create({ kind: 'bullet' }, paragraphType.create())
    const afterHeading = $from.after()
    const tr = state.tr.insert(afterHeading, bullet)
    // The caret lands inside the new empty bullet: one past the list's open
    // token, one past the paragraph's, is the first text position within it.
    tr.setSelection(TextSelection.create(tr.doc, afterHeading + 2))
    dispatch(tr.scrollIntoView())
  }
  return true
}

/**
 * "Type a title, press Return, start bullets." When this extension is applied,
 * pressing Enter at the end of a heading drops the caret into a fresh empty
 * bullet instead of a plain paragraph.
 *
 * Not part of `defineEditorExtension`; the React package applies it via the
 * `bulletAfterHeading` prop (off by default). The high priority lets the command
 * run before the editor's default Enter so it can claim the end-of-heading case.
 */
export function defineBulletAfterHeading(): PlainExtension {
  return withPriority(defineKeymap({ Enter: bulletAfterHeadingOnEnter }), Priority.high)
}
