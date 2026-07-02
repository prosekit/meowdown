import { defineKeymap, isTextSelection, type PlainExtension } from '@prosekit/core'
import { triggerAutocomplete } from '@prosekit/extensions/autocomplete'
import { TextSelection, type Command } from '@prosekit/pm/state'

const WIKILINK_OPEN = '[['

interface OpenWikilinkMenuOptions {
  /**
   * Whether an empty selection may open the menu.
   */
  allowEmpty: boolean
}

/**
 * Inserts the `[[` wikilink trigger at the cursor and opens the wikilink menu.
 * Any selected text becomes the initial query, so selecting "Cat naps" and
 * running this yields `[[Cat naps` with the menu searching it. A leading `[` in
 * the selection is dropped; a selection that already starts with `[[`, that
 * spans more than one block, or that sits in a code block is left untouched.
 */
function openWikilinkMenu({ allowEmpty }: OpenWikilinkMenuOptions): Command {
  return (state, dispatch) => {
    const { selection } = state
    if (!isTextSelection(selection)) {
      return false
    }
    if (!allowEmpty && selection.empty) {
      return false
    }
    if (!selection.$head.sameParent(selection.$anchor)) {
      return false
    }
    // The menu never opens in a code block, so a `[[` there is inert noise.
    if (selection.$head.parent.type.spec.code) {
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
}

/**
 * Binds `Mod-Shift-k` to open the wikilink menu, and `[` to wrap a selected
 * phrase into an open wikilink (`[[phrase`) with the menu searching it.
 */
export function defineWikilinkTrigger(): PlainExtension {
  return defineKeymap({
    'Mod-Shift-k': openWikilinkMenu({ allowEmpty: true }),
    '[': openWikilinkMenu({ allowEmpty: false }),
  })
}
