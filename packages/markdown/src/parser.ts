import type { MarkdownParser } from '@lezer/markdown'
import { GFM, type InlineContext, parser as defaultParser } from '@lezer/markdown'

import { bareAutolink } from './bare-autolink.ts'
import { hashtag } from './hashtag.ts'
import { highlight } from './highlight.ts'
import { math } from './math.ts'
import { schemeAutolink } from './scheme-autolink.ts'
import { wikiEmbed } from './wiki-embed.ts'
import { wikilink } from './wikilink.ts'

export type { MarkdownParser }

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
 * domain autolink, bare `scheme://` autolink, `==Highlight==`, and
 * `$math$` inline syntax. Use when both block and inline structure must
 * be recognized.
 */
export const gfmParser: MarkdownParser = defaultParser.configure([
  GFM,
  hashtag,
  wikiEmbed,
  wikilink,
  bareAutolink,
  schemeAutolink,
  highlight,
  math,
])

/**
 * `@lezer/markdown` parser configured with GFM plus a `SkipInline`
 * parser that short-circuits the inline phase. The block phase still
 * produces all block-level structural marks (HeaderMark, ListMark,
 * QuoteMark, CodeMark, CodeText, …), but no Emphasis / Link /
 * InlineCode etc. nodes are ever created.
 */
export const gfmBlockOnlyParser: MarkdownParser = gfmParser.configure({
  parseInline: [{ name: 'SkipInline', before: 'Escape', parse: consumeAllInline }],
})
