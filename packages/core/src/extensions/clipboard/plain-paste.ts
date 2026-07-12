import { definePlugin, getNodeType, type PlainExtension } from '@prosekit/core'
import { DOMParser, DOMSerializer, Fragment, Slice } from '@prosekit/pm/model'
import type { ProseMirrorNode, ResolvedPos, Schema } from '@prosekit/pm/model'
import { Plugin, PluginKey } from '@prosekit/pm/state'

import type { NodeName } from '../node-names.ts'

/**
 * Turn pasted plain text into blocks with markdown newline semantics: a blank
 * line separates paragraphs (`aaa\n\nbbb` inserts no empty paragraph), a
 * single `\n` stays a soft break inside one paragraph, and a run of K blank
 * lines restores K-1 empty paragraphs (the gap-paragraph model of
 * `md-to-pm.ts`). Leading and trailing newlines are trimmed.
 */
function plainTextToSlice(schema: Schema, raw: string): Slice {
  const text = raw.replaceAll(/\r\n?/g, '\n')
  const trimmed = text.replace(/^\n+/, '').replace(/\n+$/, '')
  if (!trimmed) return Slice.empty

  const paragraph = getNodeType(schema, 'paragraph' satisfies NodeName)
  const blocks: ProseMirrorNode[] = []
  // Splitting with a captured separator keeps the blank-line runs: even
  // indexes are block texts, odd indexes are the `\n{2,}` runs between them.
  const parts = trimmed.split(/(\n{2,})/)
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]
    if (index % 2 === 0) {
      blocks.push(paragraph.create(null, part ? schema.text(part) : undefined))
    } else {
      const blankLines = part.length - 1
      for (let gap = 1; gap < blankLines; gap++) {
        blocks.push(paragraph.create())
      }
    }
  }
  return Slice.maxOpen(Fragment.from(blocks))
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
