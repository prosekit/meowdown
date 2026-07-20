import { defineCommands, isTextSelection, setBlockType } from '@prosekit/core'
import { triggerAutocomplete } from '@prosekit/extensions/autocomplete'
import { unwrapList } from '@prosekit/extensions/list'
import { chainCommands, lift } from '@prosekit/pm/commands'
import { Slice, type ResolvedPos } from '@prosekit/pm/model'
import { TextSelection, type Command } from '@prosekit/pm/state'

import { markdownToDoc } from '../converters/md-to-pm.ts'

import { isNodeOfType, type NodeName } from './node-names.ts'
import { getNodeBuildersForSchema } from './schema.ts'

function selectText(anchor: number, head?: number): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const selection = TextSelection.create(state.doc, anchor, head)
      const tr = state.tr.setSelection(selection)
      dispatch(tr)
    }
    return true
  }
}

function selectTextBetween($anchor: ResolvedPos, $head: ResolvedPos, bias?: number): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const selection = TextSelection.between($anchor, $head, bias)
      const tr = state.tr.setSelection(selection)
      dispatch(tr)
    }
    return true
  }
}

function insertMarkdown(markdown: string): Command {
  return (state, dispatch) => {
    if (!markdown.trim()) return false
    const nodes = getNodeBuildersForSchema(state.schema)
    const content = markdownToDoc(markdown, { nodes }).content
    if (content.childCount === 0) return false
    const isSingleParagraph =
      content.childCount === 1 && isNodeOfType(content.child(0), 'paragraph')
    const slice = isSingleParagraph
      ? new Slice(content, 1, 1)
      : new Slice(content, 0, Slice.maxOpen(content).openEnd)
    if (dispatch) {
      const tr = state.tr
      const selection = tr.selection
      if (!isTextSelection(selection) || !selection.empty) {
        tr.setSelection(TextSelection.near(selection.$from))
      }
      dispatch(tr.replaceSelection(slice).scrollIntoView())
    }
    return true
  }
}

/**
 * Inserts menu trigger text (`/`, `[[`, `@`, `#`) at the cursor and opens the
 * matching autocomplete menu in the same transaction. The menus normally only
 * open while the user is typing, so a host inserting the trigger itself (e.g.
 * from a toolbar button) must go through this command instead of a plain
 * `insertText`. When a non-space character sits right before the caret, a
 * space is inserted first so the trigger can match, like a user would type
 * it. In a code block, where no menu can open, the command does nothing.
 */
function insertTrigger(text: string): Command {
  return (state, dispatch) => {
    if (!text) return false
    const $from = state.selection.$from
    if ($from.parent.type.spec.code) return false
    if (dispatch) {
      const offset = $from.parentOffset
      const charBefore = offset === 0 ? '' : $from.parent.textBetween(offset - 1, offset)
      const needsSpace = charBefore !== '' && !/\s/u.test(charBefore)
      // Without an explicit range, insertText inherits the marks at the
      // cursor, like normal typing would.
      const tr = state.tr.insertText(needsSpace ? ` ${text}` : text)
      triggerAutocomplete(tr)
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

/**
 * Pastes `text` as plain text, through the exact code path of a Shift-paste
 * ("paste without formatting"): every newline run becomes a paragraph break,
 * and the paste-handling plugins (link paste, embeds) still get a look. Made
 * for host apps whose shell owns the Mod-Shift-V shortcut — a desktop menu
 * accelerator swallows the keystroke before the webview sees it, so the shell
 * must read the clipboard itself and hand the text to this command.
 */
function pastePlainText(text: string): Command {
  return (state, dispatch, view) => {
    if (!text || !view) return false
    if (!dispatch) return true
    return view.pasteText(text)
  }
}

/**
 * Turns the current block into plain text, peeling one layer per call: a
 * non-paragraph textblock becomes a paragraph, then a paragraph in a list
 * loses its marker, then a paragraph in a blockquote lifts out of it.
 */
function turnIntoText(): Command {
  return chainCommands(setBlockType({ type: 'paragraph' satisfies NodeName }), unwrapList(), lift)
}

function scrollIntoView(): Command {
  return (state, dispatch) => {
    if (dispatch) {
      dispatch(state.tr.scrollIntoView())
    }
    return true
  }
}

export function defineEditorCommands() {
  return defineCommands({
    insertMarkdown,
    insertTrigger,
    pastePlainText,
    scrollIntoView,
    selectText,
    selectTextBetween,
    turnIntoText,
  })
}
