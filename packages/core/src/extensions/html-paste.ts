import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey } from '@prosekit/pm/state'

import { htmlToMarkdown } from '../converters/html-to-md.ts'
import { markdownToDoc } from '../converters/md-to-pm.ts'

import { getSemanticDOMSerializer } from './clipboard/clipboard-serializer.ts'
import { getNodeBuildersForSchema } from './schema.ts'

const htmlPasteKey = new PluginKey('meowdown-html-paste')

/**
 * meowdown's own clipboard HTML, which must skip the markdown conversion and
 * go to the native `data-md` parse path. Foreign ProseMirror editors also
 * write `data-pm-slice`, so the check needs a meowdown-specific signature:
 * the `data-meowdown` stamp, or (for HTML copied from an older meowdown) the
 * editor DOM's `md-mark` spans next to `data-pm-slice`.
 */
function isMeowdownClipboardHTML(html: string): boolean {
  if (html.includes('data-meowdown')) return true
  return html.includes('data-pm-slice') && html.includes('md-mark')
}

/**
 * Paste foreign rich-text HTML as meowdown Markdown. Rewrites the clipboard's
 * `text/html` through `transformPastedHTML`: foreign HTML is converted to a
 * Markdown string, reparsed into meowdown nodes (literal source text, no marks),
 * and re-serialized to HTML so ProseMirror's own clipboard parser inserts it with
 * the right open depths. `<strong>bold</strong>` thus lands as the text `**bold**`,
 * which the inline-mark plugin renders. The re-serialized HTML carries `data-md`,
 * so the textblock contents survive the whitespace-collapsing HTML parse.
 */
export function defineHTMLPaste(): PlainExtension {
  return definePlugin(
    new Plugin({
      key: htmlPasteKey,
      props: {
        transformPastedHTML: (html, view) => {
          if (isMeowdownClipboardHTML(html)) return html

          const parent = view.state.selection.$from.parent
          if (!parent.inlineContent || parent.type.spec.code) return html

          const markdown = htmlToMarkdown(html)
          if (!markdown.trim()) return html

          const nodes = getNodeBuildersForSchema(view.state.schema)
          const doc = markdownToDoc(markdown, { nodes })
          const serializer = getSemanticDOMSerializer(view.state.schema)
          const container = document.createElement('div')
          container.append(serializer.serializeFragment(doc.content))
          return container.innerHTML
        },
      },
    }),
  )
}
