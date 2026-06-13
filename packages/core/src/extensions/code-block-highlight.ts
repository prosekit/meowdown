import type { Extension } from '@prosekit/core'
import { defineCodeBlockHighlight, type HighlightParser } from '@prosekit/extensions/code-block'
import { createParser } from 'prosemirror-highlight/shiki'
import type { BundledLanguage, Highlighter, SpecialLanguage } from 'shiki'

const LIGHT_THEME = 'github-light'
const DARK_THEME = 'github-dark'

// Languages shiki resolves without loading a grammar.
const PLAIN_LANGUAGE: SpecialLanguage = 'text'

let highlighter: Highlighter | undefined
let highlighterPromise: Promise<Highlighter> | undefined
let parser: HighlightParser | undefined

const loadedLanguages = new Set<string>()
const failedLanguages = new Set<string>()

async function loadHighlighter(): Promise<Highlighter> {
  const [{ createHighlighter }, { createJavaScriptRegexEngine }] = await Promise.all([
    import('shiki/bundle/full'),
    import('shiki/engine/javascript'),
  ])
  return await createHighlighter({
    themes: [LIGHT_THEME, DARK_THEME],
    langs: [],
    // The JavaScript engine is smaller than the WASM one and needs no async setup.
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })
}

function normalizeLanguage(language: string | undefined): string {
  return language || PLAIN_LANGUAGE
}

// `prosemirror-highlight` retries the node whenever the parser returns a
// promise, so each missing piece (highlighter, then grammar) resolves on a
// later pass and the decorations land once everything is ready.
const lazyParser: HighlightParser = (options) => {
  if (!highlighter) {
    highlighterPromise ??= loadHighlighter().then((instance) => (highlighter = instance))
    return highlighterPromise.then(() => undefined)
  }

  const language = normalizeLanguage(options.language)
  if (
    language !== PLAIN_LANGUAGE &&
    !loadedLanguages.has(language) &&
    !failedLanguages.has(language)
  ) {
    return highlighter
      .loadLanguage(language as BundledLanguage)
      .then(() => {
        loadedLanguages.add(language)
      })
      .catch(() => {
        failedLanguages.add(language)
      })
  }

  parser ??= createParser(highlighter, {
    themes: { light: LIGHT_THEME, dark: DARK_THEME },
    defaultColor: false,
  })
  const resolved = failedLanguages.has(language) ? PLAIN_LANGUAGE : language
  return parser({ ...options, language: resolved })
}

/**
 * Adds Shiki syntax highlighting to `codeBlock` nodes. Tokens carry both the
 * light and dark theme colors as CSS variables (`--shiki-light` /
 * `--shiki-dark`) so the stylesheet can pick one per color scheme.
 */
export function defineCodeBlockSyntaxHighlight(): Extension {
  return defineCodeBlockHighlight({ parser: lazyParser, nodeTypes: ['codeBlock'] })
}
