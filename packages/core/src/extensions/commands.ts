import { defineCommands, isTextSelection, setBlockType } from '@prosekit/core'
import { triggerAutocomplete } from '@prosekit/extensions/autocomplete'
import { unwrapList } from '@prosekit/extensions/list'
import { chainCommands, lift } from '@prosekit/pm/commands'
import { Slice, type ResolvedPos } from '@prosekit/pm/model'
import { TextSelection, type Command } from '@prosekit/pm/state'

import { markdownToDoc } from '../converters/md-to-pm.ts'

import { isNodeOfType, type NodeName } from './node-names.ts'
import { getNodeBuildersForSchema } from './schema.ts'

/** @internal */
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

/** @internal */
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

/** @internal */
export function insertMarkdown(markdown: string): Command {
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
 *
 * @internal
 */
export function insertTrigger(text: string): Command {
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
 * Turns the current block into plain text, peeling one layer per call: a
 * non-paragraph textblock becomes a paragraph, then a paragraph in a list
 * loses its marker, then a paragraph in a blockquote lifts out of it.
 *
 * @internal
 */
export function turnIntoText(): Command {
  return chainCommands(setBlockType({ type: 'paragraph' satisfies NodeName }), unwrapList(), lift)
}

/** @internal */
export function scrollIntoView(): Command {
  return (state, dispatch) => {
    if (dispatch) {
      dispatch(state.tr.scrollIntoView())
    }
    return true
  }
}

/**
 * Deletes the block at `pos` and puts the caret where it was. A block that is
 * the only child of its parent gives way to an empty default block (usually a
 * paragraph), since the parent cannot be left empty.
 *
 * @internal
 */
export function deleteBlock(pos: number): Command {
  return (state, dispatch) => {
    const $pos = state.doc.resolve(pos)
    const node = $pos.nodeAfter
    if (!node) return false
    if (dispatch) {
      const end = pos + node.nodeSize
      const tr =
        $pos.parent.childCount === 1
          ? state.tr.replaceWith(
              pos,
              end,
              $pos.parent.type.contentMatch.defaultType?.createAndFill() ?? [],
            )
          : state.tr.delete(pos, end)
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), 1))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

export function defineEditorCommands() {
  return defineCommands({
    insertMarkdown,
    insertTrigger,
    scrollIntoView,
    selectText,
    selectTextBetween,
    turnIntoText,
  })
}
