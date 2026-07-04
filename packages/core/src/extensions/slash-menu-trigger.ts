import { defineKeymap, isTextSelection, type PlainExtension } from '@prosekit/core'
import { triggerAutocomplete } from '@prosekit/extensions/autocomplete'
import type { Command } from '@prosekit/pm/state'

// Placeholder for a leaf node (image, hard break) so it reads as a non-space
// character, matching how the autocomplete matcher sees the text.
const OBJECT_REPLACEMENT_CHARACTER = '￼'

/**
 * Inserts the typed `/` and opens the slash menu in the same transaction. Only
 * fires where the menu could trigger anyway: an empty text cursor at the start
 * of a textblock or right after whitespace, outside code. Anywhere else it
 * defers to normal typing.
 */
const insertSlashAndOpenMenu: Command = (state, dispatch) => {
  const { selection } = state
  if (!isTextSelection(selection) || !selection.empty) {
    return false
  }
  const $head = selection.$head
  if (!$head.parent.isTextblock || $head.parent.type.spec.code) {
    return false
  }
  const offset = $head.parentOffset
  const charBefore =
    offset === 0
      ? ''
      : $head.parent.textBetween(offset - 1, offset, null, OBJECT_REPLACEMENT_CHARACTER)
  if (charBefore && !/\s/u.test(charBefore)) {
    return false
  }

  if (dispatch) {
    // Without an explicit range, insertText inherits the marks at the cursor,
    // like normal typing would.
    const tr = state.tr.insertText('/')
    // A keymap insert bypasses the text-input path the autocomplete matcher
    // listens to, so tag the same transaction to re-scan and open the menu.
    triggerAutocomplete(tr)
    dispatch(tr.scrollIntoView())
  }
  return true
}

/**
 * Binds `/` to insert the slash and open the slash menu in one step, making
 * the menu appear the moment `/` is typed in a triggering spot instead of
 * relying on the text-input matcher alone.
 */
export function defineSlashMenuTrigger(): PlainExtension {
  return defineKeymap({
    '/': insertSlashAndOpenMenu,
  })
}
