import { definePlugin, type PlainExtension } from '@prosekit/core'
import { DOMParser, DOMSerializer, Slice } from '@prosekit/pm/model'
import type { ResolvedPos, Schema } from '@prosekit/pm/model'
import { Plugin, PluginKey } from '@prosekit/pm/state'

import { markdownToDoc } from '../../converters/md-to-pm.ts'
import { getNodeBuildersForSchema } from '../schema.ts'

/**
 * Parse pasted plain text as markdown: `- [ ] task`, `# heading`, fenced code
 * and the other block constructs become real nodes, while inline syntax stays
 * literal source text that the inline-mark plugin renders. Newline semantics
 * follow `md-to-pm.ts`: a blank line separates paragraphs, a single `\n` stays
 * a soft break inside one paragraph, and a run of K blank lines restores K-1
 * empty gap paragraphs. Leading and trailing newlines are trimmed.
 */
function plainTextToSlice(schema: Schema, raw: string): Slice {
  const text = raw.replaceAll(/\r\n?/g, '\n')
  const trimmed = text.replace(/^\n+/, '').replace(/\n+$/, '')
  if (!trimmed) return Slice.empty

  const nodes = getNodeBuildersForSchema(schema)
  const doc = markdownToDoc(trimmed, { nodes })
  return Slice.maxOpen(doc.content)
}

/**
 * ProseMirror's own plain-text handling, kept for Shift-paste: every newline
 * run becomes a paragraph break. Mirrors `parseFromClipboard` in
 * prosemirror-view, which this prop replaces.
 */
function defaultTextSlice(schema: Schema, text: string, $context: ResolvedPos): Slice {
  const marks = $context.marks()
  const serializer = DOMSerializer.fromSchema(schema)
  const container = document.createElement('div')
  for (const block of text.split(/(?:\r\n?|\n)+/)) {
    const paragraphDOM = container.appendChild(document.createElement('p'))
    if (block) {
      paragraphDOM.appendChild(serializer.serializeNode(schema.text(block, marks)))
    }
  }
  return DOMParser.fromSchema(schema).parseSlice(container, {
    preserveWhitespace: true,
    context: $context,
  })
}

export function definePlainTextPaste(): PlainExtension {
  return definePlugin(
    new Plugin({
      key: new PluginKey('meowdown-plain-paste'),
      props: {
        clipboardTextParser: (text, $context, plain, view) => {
          const { schema } = view.state
          if (plain) return defaultTextSlice(schema, text, $context)
          return plainTextToSlice(schema, text)
        },
      },
    }),
  )
}
