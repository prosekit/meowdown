import { definePlugin, type PlainExtension } from '@prosekit/core'
import type { ProseMirrorNode } from '@prosekit/pm/model'
import { Plugin, PluginKey } from '@prosekit/pm/state'

import { docToMarkdown } from '../converters/pm-to-md.ts'

const markdownCopyKey = new PluginKey('meowdown-markdown-copy')

/**
 * Serialize copied/cut content to Markdown for the clipboard's `text/plain`, so
 * pasting meowdown content into a plain-text field yields real Markdown (`- `
 * list markers, blank-line block separation) instead of bare `textContent`.
 *
 * The copied fragment is wrapped in a `doc` so the existing block serializer can
 * walk it. A purely inline fragment (a partial-paragraph copy) does not fit
 * `doc`'s `block+` content, so it falls back to the inline text.
 */
export function defineMarkdownCopy(): PlainExtension {
  return definePlugin(
    new Plugin({
      key: markdownCopyKey,
      props: {
        clipboardTextSerializer: (slice, view) => {
          const fragment = slice.content
          let doc: ProseMirrorNode | undefined
          try {
            doc = view.state.schema.topNodeType.createAndFill(undefined, fragment) ?? undefined
          } catch {
            doc = undefined
          }
          if (!doc) return fragment.textBetween(0, fragment.size, '\n', '\n')
          return docToMarkdown(doc).replace(/\n+$/, '')
        },
      },
    }),
  )
}
