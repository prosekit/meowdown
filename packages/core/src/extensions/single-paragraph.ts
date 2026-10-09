import { definePlugin, Priority, withPriority, type PlainExtension } from '@prosekit/core'
import { undoInputRule } from '@prosekit/pm/inputrules'
import { Plugin, PluginKey, TextSelection, type Transaction } from '@prosekit/pm/state'

import { docToParagraphMarkdown, paragraphMarkdownToDoc } from '../converters/paragraph.ts'

import { getEditorConfig } from './editor-config-getter.ts'
import { isNodeOfType } from './node-names.ts'
import { getNodeBuildersForSchema } from './schema.ts'

const singleParagraphPluginKey = new PluginKey('single-paragraph')

/**
 * Keep the document to one paragraph while `singleParagraph` is set in the
 * editor config. A block input rule that just fired is undone the way
 * Backspace undoes it, so the typed prefix stays as text. Anything else that
 * arrives as blocks (a paste, a command) flattens into paragraph text
 * separated by soft lines.
 */
export function defineSingleParagraph(): PlainExtension {
  return withPriority(
    definePlugin(
      new Plugin({
        key: singleParagraphPluginKey,
        appendTransaction(transactions, _oldState, state) {
          if (!getEditorConfig(state).singleParagraph) return
          if (!transactions.some((transaction) => transaction.docChanged)) return
          const markdown = docToParagraphMarkdown(state.doc)
          if (
            state.doc.childCount === 1 &&
            isNodeOfType(state.doc.child(0), 'paragraph') &&
            state.doc.child(0).textContent === markdown
          )
            return
          let undone: Transaction | undefined
          if (undoInputRule(state, (transaction) => (undone = transaction))) return undone
          const doc = paragraphMarkdownToDoc(markdown, getNodeBuildersForSchema(state.schema))
          const position = Math.min(state.selection.head, doc.content.size - 1)
          const transaction = state.tr.replaceWith(0, state.doc.content.size, doc.content)
          return transaction.setSelection(
            TextSelection.create(transaction.doc, Math.max(1, position)),
          )
        },
      }),
    ),
    Priority.highest,
  )
}
