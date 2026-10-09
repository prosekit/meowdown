import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, TextSelection } from '@prosekit/pm/state'

import { docToParagraphMarkdown, paragraphMarkdownToDoc } from '../converters/paragraph.ts'

import { getEditorConfig } from './editor-config-getter.ts'
import { isNodeOfType } from './node-names.ts'
import { getNodeBuildersForSchema } from './schema.ts'

const singleParagraphPluginKey = new PluginKey('single-paragraph')

/**
 * Keep the document to one paragraph while `singleParagraph` is set in the
 * editor config. Block input rules and enter rules already stay quiet then
 * (see `block-rule.ts`); this flattens what still arrives as blocks, such as a
 * paste or a command, into paragraph text separated by soft lines.
 */
export function defineSingleParagraph(): PlainExtension {
  return definePlugin(
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
        const doc = paragraphMarkdownToDoc(markdown, getNodeBuildersForSchema(state.schema))
        const position = Math.min(state.selection.head, doc.content.size - 1)
        const transaction = state.tr.replaceWith(0, state.doc.content.size, doc.content)
        return transaction.setSelection(
          TextSelection.create(transaction.doc, Math.max(1, position)),
        )
      },
    }),
  )
}
