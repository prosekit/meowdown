import { LanguageDescription, type LanguageSupport } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { classHighlighter, highlightTree } from '@lezer/highlight'
import type { Extension } from '@prosekit/core'
import { defineCodeBlockHighlight, type HighlightParser } from '@prosekit/extensions/code-block'
import { createParser } from 'prosemirror-highlight/lezer'

import type { NodeName } from './node-names.ts'

// Per language attribute: the loaded CodeMirror/Lezer support, or `null` once we
// know the language is unsupported so we stop retrying it. Shared by the editor
// highlight plugin and the static `getCodeTokens` renderer, so both load each
// grammar once and tag tokens with the same `@lezer/highlight` classes.
const supportCache = new Map<string, LanguageSupport | null>()

// Per language attribute: the prosemirror-highlight parser, derived from the
// cached support, for the editor's decoration path.
const parserCache = new Map<string, HighlightParser>()

// `math` is not a @codemirror/language-data name: alias it to LaTeX (the
// legacy stex mode) so the TeX source inside a math block gets highlighted.
const LANGUAGE_ALIASES: Record<string, string> = { math: 'latex' }

async function loadLanguageSupport(language: string): Promise<LanguageSupport | null> {
  const cached = supportCache.get(language)
  if (cached !== undefined) return cached

  const description = LanguageDescription.matchLanguageName(
    languages,
    LANGUAGE_ALIASES[language] ?? language,
    true,
  )
  if (!description) {
    supportCache.set(language, null)
    return null
  }

  let support = description.support
  if (!support) {
    try {
      support = await description.load()
    } catch (error) {
      console.error(`[meowdown] Failed to load language "${language}":`, error)
      supportCache.set(language, null)
      return null
    }
  }

  supportCache.set(language, support)
  return support
}

function getParser(language: string, support: LanguageSupport): HighlightParser {
  const cached = parserCache.get(language)
  if (cached) return cached
  const parser = createParser({
    parse: (options) => support.language.parser.parse(options.content),
    highlighter: classHighlighter,
  })
  parserCache.set(language, parser)
  return parser
}

const lazyParser: HighlightParser = (options) => {
  const language = options.language?.trim()
  if (!language) return []

  const support = supportCache.get(language)
  if (support === null) return []
  if (support) return getParser(language, support)(options)

  // Not loaded yet: trigger the load and let the plugin re-run once it resolves.
  return loadLanguageSupport(language).then(() => undefined)
}

/**
 * Adds syntax highlighting to `codeBlock` nodes, parsing each block with the
 * matching CodeMirror/Lezer grammar (loaded on demand from
 * `@codemirror/language-data`). Tokens are tagged with `@lezer/highlight`
 * `tok-*` classes; the default theme colors them per color scheme.
 */
export function defineCodeBlockSyntaxHighlight(): Extension {
  return defineCodeBlockHighlight({
    parser: lazyParser,
    nodeTypes: ['codeBlock' satisfies NodeName],
  })
}

/** A highlighted span of code: `[from, to)` carries the `@lezer/highlight` classes. */
export type CodeToken = readonly [from: number, to: number, classes: string]

function tokenize(code: string, support: LanguageSupport): CodeToken[] {
  const tree = support.language.parser.parse(code)
  const tokens: CodeToken[] = []
  highlightTree(tree, classHighlighter, (from, to, classes) => {
    tokens.push([from, to, classes])
  })
  return tokens
}

/**
 * Highlight `code` in `language` into `tok-*` token spans, the same classes the
 * editor's decorations use. Returns synchronously when the grammar is already
 * loaded (the common path, no render flash), and a `Promise` only when a grammar
 * must load on demand. Returns `[]` for an empty or unsupported language.
 */
export function getCodeTokens(code: string, language: string): CodeToken[] | Promise<CodeToken[]> {
  const trimmed = language.trim()
  if (!trimmed) return []

  const support = supportCache.get(trimmed)
  if (support === null) return []
  if (support) return tokenize(code, support)

  return loadLanguageSupport(trimmed).then((loaded) => (loaded ? tokenize(code, loaded) : []))
}
