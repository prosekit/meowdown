import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { classHighlighter } from '@lezer/highlight'
import type { Extension } from '@prosekit/core'
import { defineCodeBlockHighlight, type HighlightParser } from '@prosekit/extensions/code-block'
import { createParser } from 'prosemirror-highlight/lezer'

// Per language attribute: a ready highlight parser, or `null` once we know the
// language is unsupported so we stop retrying it.
const parserCache = new Map<string, HighlightParser | null>()

async function loadParserForLanguage(language: string): Promise<void> {
  const description = LanguageDescription.matchLanguageName(languages, language, true)
  if (!description) {
    parserCache.set(language, null)
    return
  }

  let support = description.support

  if (!support) {
    try {
      support = await description.load()
    } catch (error) {
      console.error(`[meowdown] Failed to load language "${language}":`, error)
      parserCache.set(language, null)
    }
  }

  if (parserCache.has(language)) {
    return
  }

  if (!support) {
    parserCache.set(language, null)
    return
  }

  const parser = createParser({
    parse: (options) => support.language.parser.parse(options.content),
    highlighter: classHighlighter,
  })
  parserCache.set(language, parser)
}

const lazyParser: HighlightParser = (options) => {
  const language = options.language?.trim()
  if (!language) return []

  const cached: HighlightParser | null | undefined = parserCache.get(language)

  if (cached) {
    return cached(options)
  }
  if (cached === null) {
    return []
  }

  return loadParserForLanguage(language)
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
