import {
  Priority,
  defineKeymap,
  getNodeType,
  withPriority,
  type PlainExtension,
} from '@prosekit/core'
import type { ListAttrs } from '@prosekit/extensions/list'
import { TextSelection, type Command } from '@prosekit/pm/state'

import type { NodeName } from './node-names.ts'

/**
 * Claim Enter only when the selection is an empty caret at the very end of the
 * document's first heading (the note's title line). Every other Enter (a later
 * heading, mid-heading, in a paragraph, inside a list) returns false and falls
 * through to the editor's default handling.
 */
const bulletAfterHeadingOnEnter: Command = (state, dispatch) => {
  const { $from, empty } = state.selection
  // Only the document's first block, and only when that block is a heading.
  if (!empty || $from.depth !== 1 || $from.index(0) !== 0) {
    return false
  }
  if ($from.parent.type.name !== ('heading' satisfies NodeName)) {
    return false
  }
  // Only at the end of the heading's text; Enter elsewhere splits as usual.
  if ($from.parentOffset !== $from.parent.content.size) {
    return false
  }
  if (dispatch) {
    const listType = getNodeType(state.schema, 'list' satisfies NodeName)
    const paragraphType = getNodeType(state.schema, 'paragraph' satisfies NodeName)
    const bullet = listType.create({ kind: 'bullet' } satisfies ListAttrs, paragraphType.create())
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
 * pressing Enter at the end of the document's first heading (the title line)
 * drops the caret into a fresh empty bullet instead of a plain paragraph.
 */
export function defineBulletAfterHeading(): PlainExtension {
  return withPriority(defineKeymap({ Enter: bulletAfterHeadingOnEnter }), Priority.high)
}
