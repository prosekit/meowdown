import {
  defineKeymap,
  definePlugin,
  isTextSelection,
  OBJECT_REPLACEMENT_CHARACTER,
  union,
  type PlainExtension,
} from '@prosekit/core'
import { triggerAutocomplete } from '@prosekit/extensions/autocomplete'
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
} from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

const WIKILINK_OPEN = '[['
const WIKILINK_QUERY = /\[\[[^[\]]*$/u
const MAX_AUTOCOMPLETE_MATCH = 200
const wikilinkCursorTrackingKey = new PluginKey('meowdown-wikilink-cursor-tracking')

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

function hasOpenWikilinkQueryBeforeCursor(state: EditorState): boolean {
  const { selection } = state
  if (!isTextSelection(selection) || !selection.empty) return false
  const { parent, parentOffset } = selection.$head
  const from = Math.max(0, parentOffset - MAX_AUTOCOMPLETE_MATCH)
  const text = parent.textBetween(from, parentOffset, '\n', OBJECT_REPLACEMENT_CHARACTER)
  return WIKILINK_QUERY.test(text)
}

function hasActiveWikilinkAutocomplete(view: EditorView): boolean {
  const match = view.dom.querySelector<HTMLElement>('.prosekit-autocomplete-match')
  return match?.dataset.autocompleteMatchText?.startsWith(WIKILINK_OPEN) ?? false
}

// ProseKit normally closes autocomplete as soon as a selection-only transaction
// moves the caret beyond the current match. Remember horizontal arrow presses
// while a wikilink match is active, then tag the resulting native cursor
// transaction so the match is re-scanned before it can be ignored. Leaving
// cursor motion to the browser preserves its grapheme and bidi handling.
function createWikilinkCursorTrackingPlugin(): Plugin {
  let cursorMoveFrom: number | undefined

  const clearCursorMove = () => {
    cursorMoveFrom = undefined
  }

  return new Plugin({
    key: wikilinkCursorTrackingKey,
    filterTransaction: (tr, state) => {
      const before = state.selection
      const after = tr.selection
      if (cursorMoveFrom !== before.head) return true
      if (
        !tr.docChanged &&
        isTextSelection(before) &&
        before.empty &&
        isTextSelection(after) &&
        after.empty &&
        before.head !== after.head &&
        before.$head.sameParent(after.$head) &&
        hasOpenWikilinkQueryBeforeCursor(state)
      ) {
        triggerAutocomplete(tr)
      }
      if (tr.docChanged || !before.eq(after)) clearCursorMove()
      return true
    },
    props: {
      handleKeyDown: (view, event) => {
        clearCursorMove()
        if (
          (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') ||
          view.composing ||
          !hasOpenWikilinkQueryBeforeCursor(view.state) ||
          !hasActiveWikilinkAutocomplete(view)
        ) {
          return false
        }

        cursorMoveFrom = view.state.selection.head
        return false
      },
      handleDOMEvents: {
        blur: () => {
          clearCursorMove()
          return false
        },
        keyup: (view) => {
          if (cursorMoveFrom == null) return false
          // At a textblock boundary there is no selection transaction to clear
          // the remembered keydown, so compare against the browser's DOM caret.
          const selection = view.dom.ownerDocument.getSelection()
          const focusNode = selection?.focusNode
          if (!focusNode || !view.dom.contains(focusNode)) {
            clearCursorMove()
            return false
          }
          const domHead = view.posAtDOM(focusNode, selection.focusOffset, 1)
          if (domHead === cursorMoveFrom) clearCursorMove()
          return false
        },
        pointerdown: () => {
          clearCursorMove()
          return false
        },
      },
    },
  })
}

/**
 * Binds `Mod-Shift-k` to open the wikilink menu, and `[` to wrap a selected
 * phrase into an open wikilink (`[[phrase`) with the menu searching it.
 */
export function defineWikilinkTrigger(): PlainExtension {
  return union(
    defineKeymap({
      'Mod-Shift-k': openWikilinkMenu({ allowEmpty: true }),
      '[': openWikilinkMenu({ allowEmpty: false }),
    }),
    definePlugin(createWikilinkCursorTrackingPlugin()),
  )
}
