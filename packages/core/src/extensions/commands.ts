import { defineCommands, isTextSelection } from '@prosekit/core'
import { triggerAutocomplete } from '@prosekit/extensions/autocomplete'
import { Slice, type ResolvedPos } from '@prosekit/pm/model'
import { TextSelection, type Command } from '@prosekit/pm/state'

import { markdownToDoc } from '../converters/md-to-pm.ts'

import type { NodeName } from './node-names.ts'
import { getNodeBuildersForSchema } from './schema.ts'

// Placeholder for a leaf node (image, hard break) so it reads as a non-space
// character, matching how the autocomplete matcher sees the text.
const OBJECT_REPLACEMENT_CHARACTER = '￼'

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
      content.childCount === 1 && content.child(0).type.name === ('paragraph' satisfies NodeName)
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
 * it — except in code, where no menu opens and the text is inserted as-is.
 */
function insertTrigger(text: string): Command {
  return (state, dispatch) => {
    if (!text) return false
    if (dispatch) {
      const $from = state.selection.$from
      const offset = $from.parentOffset
      const charBefore =
        offset === 0
          ? ''
          : $from.parent.textBetween(offset - 1, offset, null, OBJECT_REPLACEMENT_CHARACTER)
      const needsSpace =
        !$from.parent.type.spec.code && charBefore !== '' && !/\s/u.test(charBefore)
      // Without an explicit range, insertText inherits the marks at the
      // cursor, like normal typing would.
      const tr = state.tr.insertText(needsSpace ? ` ${text}` : text)
      triggerAutocomplete(tr)
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

export function defineEditorCommands() {
  return defineCommands({
    insertMarkdown,
    insertTrigger,
    selectText,
    selectTextBetween,
  })
}
