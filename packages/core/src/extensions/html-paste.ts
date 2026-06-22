import { definePlugin, Priority, withPriority, type PlainExtension } from '@prosekit/core'
import { Slice } from '@prosekit/pm/model'
import { Plugin, PluginKey } from '@prosekit/pm/state'

import { htmlToMarkdown } from '../converters/html-to-md.ts'
import { markdownToDoc } from '../converters/md-to-pm.ts'

import { getNodeBuildersForSchema } from './schema.ts'

const htmlPasteKey = new PluginKey('meowdown-html-paste')

/**
 * Paste foreign rich-text HTML as meowdown Markdown. Converts the clipboard's
 * `text/html` to a Markdown string, reparses it with the editor's own schema,
 * and replaces the selection. meowdown's (or any ProseMirror editor's) own
 * clipboard, tagged `data-pm-slice`, is left to the default path, which already
 * round-trips because the literal `**` lives in its text.
 *
 * Registered at low priority so the image-file and embed-URL paste handlers
 * claim their cases first.
 */
export function defineHTMLPaste(): PlainExtension {
  return withPriority(
    definePlugin(
      new Plugin({
        key: htmlPasteKey,
        props: {
          handlePaste: (view, event) => {
            const parent = view.state.selection.$from.parent
            // Code blocks paste as plain text; let the default path handle them.
            if (!parent.inlineContent || parent.type.spec.code) return false

            const html = event.clipboardData?.getData('text/html')
            if (!html) return false

            // Don't double-encode our own (or another PM editor's) clipboard.
            if (html.includes('data-pm-slice')) return false

            const markdown = htmlToMarkdown(html)
            if (!markdown.trim()) return false

            const nodes = getNodeBuildersForSchema(view.state.schema)
            const doc = markdownToDoc(markdown, { nodes })
            const slice = Slice.maxOpen(doc.content)
            view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView())
            return true
          },
        },
      }),
    ),
    Priority.low,
  )
}
