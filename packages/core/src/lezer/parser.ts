import { GFM, type InlineContext, parser as defaultParser } from '@lezer/markdown'

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
 * task list, autolink). Use when both block and inline structure must
 * be recognized.
 */
export const gfmParser = defaultParser.configure([GFM])

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
