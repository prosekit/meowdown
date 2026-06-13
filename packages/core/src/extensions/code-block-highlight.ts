import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { classHighlighter } from '@lezer/highlight'
import type { Extension } from '@prosekit/core'
import { defineCodeBlockHighlight, type HighlightParser } from '@prosekit/extensions/code-block'
import { createParser } from 'prosemirror-highlight/lezer'

// Per language attribute: a ready highlight parser, or `null` once we know the
// language is unsupported so we stop retrying it.
const parserCache = new Map<string, HighlightParser | null>()

function buildParser(description: LanguageDescription): HighlightParser {
  const language = description.support!.language
  return createParser({
    parse: (options) => language.parser.parse(options.content),
    highlighter: classHighlighter,
  })
}

// `prosemirror-highlight` retries the node whenever the parser returns a
// promise, so the CodeMirror grammar loads on a first pass and the decorations
// land on the next one. Tokens get `@lezer/highlight` `tok-*` classes that the
// stylesheet colors.
const lazyParser: HighlightParser = (options) => {
  const language = options.language?.trim()
  if (!language) return []

  const cached = parserCache.get(language)
  if (cached !== undefined) {
    return cached ? cached(options) : []
  }

  const description = LanguageDescription.matchLanguageName(languages, language, true)
  if (!description) {
    parserCache.set(language, null)
    return []
  }

  if (description.support) {
    const parser = buildParser(description)
    parserCache.set(language, parser)
    return parser(options)
  }

  return description
    .load()
    .then(() => undefined)
    .catch(() => {
      parserCache.set(language, null)
    })
}

/**
 * Adds syntax highlighting to `codeBlock` nodes, parsing each block with the
 * matching CodeMirror/Lezer grammar (loaded on demand from
 * `@codemirror/language-data`). Tokens are tagged with `@lezer/highlight`
 * `tok-*` classes; the default theme colors them per color scheme.
 */
export function defineCodeBlockSyntaxHighlight(): Extension {
  return defineCodeBlockHighlight({ parser: lazyParser, nodeTypes: ['codeBlock'] })
}
