import { definePlugin, type PlainExtension } from '@prosekit/core'
import { DOMSerializer } from '@prosekit/pm/model'
import { Plugin, PluginKey } from '@prosekit/pm/state'

import { htmlToMarkdown } from '../converters/html-to-md.ts'
import { markdownToDoc } from '../converters/md-to-pm.ts'

import { getNodeBuildersForSchema } from './schema.ts'

const htmlPasteKey = new PluginKey('meowdown-html-paste')

/**
 * Paste foreign rich-text HTML as meowdown Markdown. Rewrites the clipboard's
 * `text/html` through `transformPastedHTML`: foreign HTML is converted to a
 * Markdown string, reparsed into meowdown nodes (literal source text, no marks),
 * and re-serialized to HTML so ProseMirror's own clipboard parser inserts it with
 * the right open depths. `<strong>bold</strong>` thus lands as the text `**bold**`,
 * which the inline-mark plugin renders.
 */
export function defineHTMLPaste(): PlainExtension {
  return definePlugin(
    new Plugin({
      key: htmlPasteKey,
      props: {
        transformPastedHTML: (html, view) => {
          if (html.includes('data-pm-slice')) return html

          const parent = view.state.selection.$from.parent
          if (!parent.inlineContent || parent.type.spec.code) return html

          const markdown = htmlToMarkdown(html)
          if (!markdown.trim()) return html

          const nodes = getNodeBuildersForSchema(view.state.schema)
          const doc = markdownToDoc(markdown, { nodes })
          const serializer = DOMSerializer.fromSchema(view.state.schema)
          const container = document.createElement('div')
          container.append(serializer.serializeFragment(doc.content))
          return container.innerHTML
        },
      },
    }),
  )
}
