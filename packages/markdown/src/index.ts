export type { SyntaxNode, Tree, TreeCursor } from '@lezer/common'
export { getAutolinkHref } from './autolink-tld.ts'
export { collectImages } from './collect-images.ts'
export { matchEmbed, parseXPostId, type EmbedKind } from './embed.ts'
export { collectInlineElements, parseInline, type InlineElement } from './inline.ts'
export { LEZER_NODE_IDS } from './node-ids.ts'
export type { LezerNodeName } from './node-names.ts'
export { gfmBlockOnlyParser, gfmParser } from './parser.ts'
export type { MarkdownParser } from './parser.ts'
export { isSpaceChar } from './unicode.ts'

export {
  checkRoundTrip,
  type CheckRoundTripOptions,
  type RoundTripFidelity,
} from './ast/check-roundtrip.ts'
export { isMarkdownAstEqual } from './ast/equal.ts'
export { parseMarkdownAst, type ParseMarkdownAstOptions } from './ast/parse.ts'
export { serializeMarkdownAst, type SerializeMarkdownAstOptions } from './ast/serialize.ts'
export type {
  MarkdownBlock,
  MarkdownBlockquote,
  MarkdownCodeBlock,
  MarkdownDocument,
  MarkdownHeading,
  MarkdownHorizontalRule,
  MarkdownHTMLComment,
  MarkdownIgnored,
  MarkdownInline,
  MarkdownListItem,
  MarkdownNode,
  MarkdownParagraph,
  MarkdownPosition,
  MarkdownPositioned,
  MarkdownTable,
  MarkdownTableCell,
  MarkdownTableRow,
  MarkdownText,
} from './ast/types.ts'

export {
  resolveMarkdownAstPath,
  walkMarkdownAst,
  type MarkdownAstEntry,
  type MarkdownAstPath,
} from './ast/path.ts'
