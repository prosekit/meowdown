import { definePlugin, Priority, withPriority, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, TextSelection, type EditorState } from '@prosekit/pm/state'

import { docToParagraphMarkdown, paragraphMarkdownToDoc } from '../converters/paragraph.ts'

import { getEditorConfig } from './editor-config-getter.ts'
import { isNodeOfType } from './node-names.ts'
import { getNodeBuildersForSchema } from './schema.ts'

const singleParagraphPluginKey = new PluginKey('single-paragraph')

/**
 * Whether the editor holds one paragraph of inline Markdown (the
 * `singleParagraph` editor config option).
 */
export function isSingleParagraph(state: EditorState): boolean {
  return !!getEditorConfig(state).singleParagraph
}

/**
 * Keep the document to one paragraph while `singleParagraph` is set. Input
 * rules and enter rules that open a block stay inert on their own (see
 * `block-rule.ts`); this flattens what still arrives as blocks, such as a
 * paste or a command, into paragraph text separated by soft lines.
 */
export function defineSingleParagraph(): PlainExtension {
  return withPriority(
    definePlugin(
      new Plugin({
        key: singleParagraphPluginKey,
        appendTransaction(transactions, _oldState, state) {
          if (!isSingleParagraph(state)) return
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
    ),
    Priority.highest,
  )
}
