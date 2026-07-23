import { definePlugin, getNodeType, type PlainExtension } from '@prosekit/core'
import { DOMParser, DOMSerializer, Slice } from '@prosekit/pm/model'
import type { ResolvedPos, Schema } from '@prosekit/pm/model'
import { Plugin, PluginKey } from '@prosekit/pm/state'

import { markdownToDoc } from '../../converters/md-to-pm.ts'
import type { NodeName } from '../node-names.ts'
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
  const paragraph = getNodeType(schema, 'paragraph' satisfies NodeName)
  const openStart = doc.childCount > 0 && doc.child(0).type === paragraph ? 1 : 0
  const openEnd = doc.childCount > 0 && doc.child(doc.childCount - 1).type === paragraph ? 1 : 0
  return new Slice(doc.content, openStart, openEnd)
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
  let parsedTextSlice: Slice | undefined
  return definePlugin(
    new Plugin({
      key: new PluginKey('meowdown-plain-paste'),
      props: {
        clipboardTextParser: (text, $context, plain, view) => {
          const { schema } = view.state
          if (plain) return defaultTextSlice(schema, text, $context)
          return (parsedTextSlice = plainTextToSlice(schema, text))
        },
        transformPasted: (slice) => {
          if (parsedTextSlice == null) return slice
          const result = parsedTextSlice
          parsedTextSlice = undefined
          return result
        },
      },
    }),
  )
}
