import { definePlugin, type PlainExtension } from '@prosekit/core'
import { DOMParser, type Schema } from '@prosekit/pm/model'
import { Plugin, PluginKey } from '@prosekit/pm/state'

import { headingFromDOM } from '../heading.ts'
import { paragraphFromDOM } from '../paragraph.ts'

/**
 * The clipboard parser: schema rules plus the `data-md` rules that restore a
 * textblock's source text from meowdown's own clipboard HTML. Registered as
 * `clipboardParser` (not in the schema) so static HTML parsing is unaffected.
 */
export function createClipboardParser(schema: Schema): DOMParser {
  return new DOMParser(schema, [
    ...paragraphFromDOM(),
    ...headingFromDOM(),
    ...DOMParser.fromSchema(schema).rules,
  ])
}

const clipboardParserKey = new PluginKey('meowdown-clipboard-parser')

export function defineClipboardParser(): PlainExtension {
  return definePlugin(({ schema }) => {
    return new Plugin({
      key: clipboardParserKey,
      props: { clipboardParser: createClipboardParser(schema) },
    })
  })
}
