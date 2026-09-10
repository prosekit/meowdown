import { defineCommands, isTextSelection, setBlockType } from '@prosekit/core'
import { triggerAutocomplete } from '@prosekit/extensions/autocomplete'
import { unwrapList } from '@prosekit/extensions/list'
import { chainCommands, lift } from '@prosekit/pm/commands'
import { Slice, type ResolvedPos } from '@prosekit/pm/model'
import { TextSelection, type Command } from '@prosekit/pm/state'

import { markdownToDoc } from '../converters/md-to-pm.ts'

import { isNodeOfType, type NodeName } from './node-names.ts'
import { getNodeBuildersForSchema } from './schema.ts'

export interface InsertMarkdownOptions {
  /**
   * Where the caret lands after a code-block fragment. `after-block` keeps
   * any paragraph suffix outside the inserted block and creates an ordinary
   * following paragraph when needed.
   */
  selection?: 'end' | 'after-block'
}

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

function insertMarkdown(markdown: string, options: InsertMarkdownOptions = {}): Command {
  return (state, dispatch) => {
    if (!markdown.trim()) return false
    const nodes = getNodeBuildersForSchema(state.schema)
    const content = markdownToDoc(markdown, { nodes }).content
    if (content.childCount === 0) return false
    const isSingleParagraph =
      content.childCount === 1 && isNodeOfType(content.child(0), 'paragraph')
    const slice = isSingleParagraph
      ? new Slice(content, 1, 1)
      : options.selection === 'after-block'
        ? new Slice(content, 0, 0)
        : new Slice(content, 0, Slice.maxOpen(content).openEnd)
    if (dispatch) {
      const tr = state.tr
      const selection = tr.selection
      if (!isTextSelection(selection) || !selection.empty) {
        tr.setSelection(TextSelection.near(selection.$from))
      }
      tr.replaceSelection(slice)
      if (options.selection === 'after-block') {
        const $selection = tr.selection.$from
        for (let depth = $selection.depth; depth > 0; depth -= 1) {
          if (!isNodeOfType($selection.node(depth), 'codeBlock')) continue
          const after = $selection.after(depth)
          const nodeAfter = tr.doc.resolve(after).nodeAfter
          if (nodeAfter === null || !isNodeOfType(nodeAfter, 'paragraph')) {
            tr.insert(after, nodes.paragraph())
          }
          tr.setSelection(TextSelection.near(tr.doc.resolve(after), 1))
          break
        }
      }
      dispatch(tr.scrollIntoView())
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
    scrollIntoView,
    selectText,
    selectTextBetween,
    turnIntoText,
  })
}
