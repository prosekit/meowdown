import { union, type PlainExtension } from '@prosekit/core'

import { defineClipboardParser } from './clipboard-parser.ts'
import { defineSemanticClipboardSerializer } from './clipboard-serializer.ts'
import { definePlainTextSerializer } from './plain-text.ts'

/**
 * The clipboard pipeline: semantic HTML with `data-md` round-trip attributes
 * plus a markdown-shaped `text/plain` on copy, and the matching `data-md`
 * parser on paste.
 */
export function defineClipboard(): PlainExtension {
  return union(
    defineSemanticClipboardSerializer(),
    definePlainTextSerializer(),
    defineClipboardParser(),
  )
}
