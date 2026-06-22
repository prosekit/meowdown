import { defineCommands, defineKeymap, union, type Extension } from '@prosekit/core'
import { triggerAutocomplete } from '@prosekit/extensions/autocomplete'
import { TextSelection, type Command } from '@prosekit/pm/state'

const WIKILINK_OPEN = '[['

/**
 * Inserts the `[[` wikilink trigger at the cursor and opens the wikilink menu.
 * Any selected text becomes the initial query, so selecting "Cat naps" and
 * running this yields `[[Cat naps` with the menu searching it. A leading `[` in
 * the selection is dropped; a selection that already starts with `[[`, or that
 * spans more than one block, is left untouched.
 */
const openWikilinkMenuCommand: Command = (state, dispatch) => {
  const { selection } = state
  if (!selection.empty && !selection.$head.sameParent(selection.$anchor)) {
    return false
  }

  let query = state.doc.textBetween(selection.from, selection.to)
  if (query.startsWith(WIKILINK_OPEN)) {
    return false
  }
  if (query.startsWith('[')) {
    query = query.slice(1)
  }
  const text = WIKILINK_OPEN + query

  if (dispatch) {
    const tr = state.tr.insertText(text, selection.from, selection.to)
    tr.setSelection(TextSelection.create(tr.doc, selection.from + text.length))
    // The programmatic insert does not open the regex-triggered menu on its own,
    // so tag the same transaction to re-scan at the new cursor and open it.
    triggerAutocomplete(tr)
    dispatch(tr.scrollIntoView())
  }
  return true
}

function openWikilinkMenu(): Command {
  return openWikilinkMenuCommand
}

/**
 * @internal
 */
export type WikilinkTriggerExtension = Extension<{
  Commands: {
    openWikilinkMenu: []
  }
}>

/**
 * Binds `Mod-Shift-k` (Cmd-Shift-K on Apple) to open the wikilink menu, and
 * exposes the same behavior as the `openWikilinkMenu` command. Apply it only
 * when a wikilink search handler is wired, so the shortcut exists exactly when
 * the menu does.
 */
export function defineWikilinkTrigger(): WikilinkTriggerExtension {
  return union(
    defineCommands({ openWikilinkMenu }),
    defineKeymap({ 'Mod-Shift-k': openWikilinkMenuCommand }),
  )
}
