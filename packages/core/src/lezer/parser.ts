import {
  GFM,
  type InlineContext,
  type MarkdownParser,
  parser as defaultParser,
} from '@lezer/markdown'

import { bareAutolink } from './bare-autolink.ts'
import { hashtag } from './hashtag.ts'
import { highlight } from './highlight.ts'
import { schemeAutolink } from './scheme-autolink.ts'
import { wikilink } from './wikilink.ts'

/**
 * Inline-parser entry that immediately claims the entire inline
 * region. Returning `cx.end` makes `MarkdownParser.parseInline` exit
 * its outer loop on the first iteration, so no other inline parser
 * ever runs on a leaf. Used by `gfmBlockOnlyParser` to skip inline
 * parsing entirely while keeping the block phase intact.
 */
function consumeAllInline(cx: InlineContext): number {
  return cx.end
}

/**
 * `@lezer/markdown` parser configured with GFM (table, strikethrough,
 * task list, autolink) plus meowdown's `Hashtag`, `Wikilink`, bare
 * domain autolink, and `==Highlight==` inline syntax. Use when both block
 * and inline structure must be recognized.
 */
export const gfmParser = defaultParser.configure([GFM, hashtag, wikilink, bareAutolink, highlight])

/**
 * `@lezer/markdown` parser configured with GFM plus a `SkipInline`
 * parser that short-circuits the inline phase. The block phase still
 * produces all block-level structural marks (HeaderMark, ListMark,
 * QuoteMark, CodeMark, CodeText, …), but no Emphasis / Link /
 * InlineCode etc. nodes are ever created.
 */
export const gfmBlockOnlyParser = gfmParser.configure({
  parseInline: [{ name: 'SkipInline', before: 'Escape', parse: consumeAllInline }],
})

// One configured parser per distinct `autolinkSchemes` list, so every editor
// created with the same option shares a parser instead of rebuilding one per
// `parseInline` call.
const parserBySchemesKey = new Map<string, MarkdownParser>()

/**
 * `gfmParser` extended with `SchemeAutolink` for the given custom URL schemes
 * (e.g. `['reflect']` makes `reflect://today` a link). Returns the shared
 * `gfmParser` when no schemes are configured. Only inline parsing is
 * extended - no node types are added - so `LEZER_NODE_IDS` (computed from
 * `gfmParser`) is valid for the returned parser too.
 */
export function gfmParserWithSchemes(autolinkSchemes?: readonly string[]): MarkdownParser {
  if (!autolinkSchemes || autolinkSchemes.length === 0) return gfmParser
  const key = autolinkSchemes.join('\n')
  let parser = parserBySchemesKey.get(key)
  if (!parser) {
    parser = gfmParser.configure(schemeAutolink(autolinkSchemes))
    parserBySchemesKey.set(key, parser)
  }
  return parser
}
