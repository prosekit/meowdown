/**
 * The `@lezer/markdown` grammar layer shared by the meowdown editor and any
 * host that needs to parse the exact same Markdown dialect (for example an
 * indexer). This package stays dependency-light on purpose: nothing here may
 * import editor code, and any change to parse semantics is a breaking change,
 * because hosts derive persistent state (search indexes, link graphs) from
 * these trees.
 */

export { getAutolinkHref } from './autolink-tld.ts'
export { bareAutolink } from './bare-autolink.ts'
export { hashtag } from './hashtag.ts'
export { highlight } from './highlight.ts'
export { collectInlineElements, parseInline, type InlineElement } from './inline.ts'
export { math } from './math.ts'
export { LEZER_NODE_IDS } from './node-ids.ts'
export { LEZER_NODE_NAMES, type LezerNodeName } from './node-names.ts'
export { gfmBlockOnlyParser, gfmParser } from './parser.ts'
export { schemeAutolink } from './scheme-autolink.ts'
export * from './unicode.ts'
export { wikiEmbed } from './wiki-embed.ts'
export { wikilink } from './wikilink.ts'
