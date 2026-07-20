import { union, type PlainExtension } from '@prosekit/core'

import { defineHTMLPaste } from '../html-paste.ts'

import { defineClipboardParser } from './clipboard-parser.ts'
import { defineSemanticClipboardSerializer } from './clipboard-serializer.ts'
import { definePlainPasteFallback } from './plain-paste-fallback.ts'
import { definePlainTextPaste } from './plain-paste.ts'
import { definePlainTextSerializer } from './plain-text.ts'

/**
 * The clipboard pipeline: semantic HTML with `data-md` round-trip attributes
 * plus a markdown-shaped `text/plain` on copy; the matching `data-md` parser,
 * the foreign-HTML markdown conversion, and the blank-line-aware plain text
 * parser on paste.
 */
export function defineClipboard(): PlainExtension {
  return union(
    defineSemanticClipboardSerializer(),
    definePlainTextSerializer(),
    defineClipboardParser(),
    defineHTMLPaste(),
    definePlainTextPaste(),
    definePlainPasteFallback(),
  )
}
