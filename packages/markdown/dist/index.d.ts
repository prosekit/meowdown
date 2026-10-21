import { MarkdownParser } from "@lezer/markdown";
import { parseXPostId } from "@post-embed/schema";
import { SyntaxNode, Tree, TreeCursor } from "@lezer/common";
//#region src/autolink-tld.d.ts
/**
 * Derive the `href` for an autolink from its visible text:
 *
 * - a URL with a scheme is used as-is
 * - an email becomes `mailto:`
 * - a `www.` URL gets an implied `https://`
 * - a bare domain on the curated TLD list gets an implied `https://`
 * - anything else returns `undefined`
 */
export declare function getAutolinkHref(urlText: string): string | undefined;
//#endregion
//#region src/collect-images.d.ts
/**
 * The destinations of the inline `![alt](src)` images in `markdown`, in
 * document order. Reference images are not resolved.
 */
export declare function collectImages(markdown: string): string[];
//#endregion
//#region src/embed.d.ts
type EmbedKind = 'x-post' | 'youtube-video';
/**
 * The embed card an image `src` renders as, or `undefined` for a plain image.
 */
export declare function matchEmbed(src: string): EmbedKind | undefined;
//#endregion
//#region src/inline.d.ts
/**
 * Narrow shape for `parser.parseInline()`'s returned elements.
 *
 * `type` / `from` / `to` are part of `@lezer/markdown`'s published
 * `Element` class. `children` exists at runtime but is marked
 * `@internal` upstream and is therefore not in the `.d.ts`. This
 * interface is the narrowest contract we can write to access it.
 */
interface InlineElement {
  readonly type: number;
  readonly from: number;
  readonly to: number;
  readonly children: readonly InlineElement[];
}
/**
 * Run `gfmParser`'s inline phase on a string and return the top-level
 * inline elements. Wraps the cast that's needed because Lezer's
 * `parseInline` is typed as returning `Element[]` (with `children`
 * marked `@internal`).
 */
export declare function parseInline(text: string): readonly InlineElement[];
/**
 * Depth-first list of every element matching `test`.
 */
export declare function collectInlineElements(nodes: readonly InlineElement[], test: (node: InlineElement) => boolean, out?: InlineElement[]): InlineElement[];
//#endregion
//#region src/node-names.d.ts
/**
 * Every `@lezer/markdown` node name `gfmParser` knows about. A unit test pins
 * this list against the parser's `nodeSet` so a `@lezer/ markdown` upgrade that
 * renames a node fails loudly.
 */
declare const LEZER_NODE_NAMES: readonly ["Document", "Paragraph", "Blockquote", "BulletList", "OrderedList", "ListItem", "FencedCode", "CodeBlock", "HorizontalRule", "ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6", "SetextHeading1", "SetextHeading2", "HTMLBlock", "HTMLTag", "CommentBlock", "Comment", "ProcessingInstructionBlock", "ProcessingInstruction", "LinkReference", "LinkLabel", "LinkTitle", "HeaderMark", "QuoteMark", "ListMark", "CodeMark", "CodeInfo", "CodeText", "Table", "TableHeader", "TableRow", "TableCell", "TableDelimiter", "Task", "TaskMarker", "Emphasis", "StrongEmphasis", "InlineCode", "Strikethrough", "Link", "Image", "URL", "Autolink", "Escape", "Entity", "HardBreak", "EmphasisMark", "LinkMark", "StrikethroughMark", "Hashtag", "WikiEmbed", "WikiEmbedMark", "Wikilink", "WikilinkMark", "Highlight", "HighlightMark", "InlineMath", "InlineMathMark", "BlockMath", "BlockMathMark"];
type LezerNodeName = (typeof LEZER_NODE_NAMES)[number];
//#endregion
//#region src/node-ids.d.ts
/**
 * Cached node name -> node id lookup for the project-wide `gfmParser`.
 */
export declare const LEZER_NODE_IDS: Readonly<Record<LezerNodeName, number>>;
//#endregion
//#region src/parser.d.ts
/**
 * `@lezer/markdown` parser configured with GFM (table, strikethrough,
 * task list, autolink) plus meowdown's `Hashtag`, `Wikilink`, bare
 * domain autolink, bare `scheme://` autolink, `==Highlight==`, and
 * `$math$` inline syntax. Use when both block and inline structure must
 * be recognized.
 */
export declare const gfmParser: MarkdownParser;
/**
 * `@lezer/markdown` parser configured with GFM plus a `SkipInline`
 * parser that short-circuits the inline phase. The block phase still
 * produces all block-level structural marks (HeaderMark, ListMark,
 * QuoteMark, CodeMark, CodeText, …), but no Emphasis / Link /
 * InlineCode etc. nodes are ever created.
 */
export declare const gfmBlockOnlyParser: MarkdownParser;
//#endregion
//#region src/unicode.d.ts
/**
 * Check if a char code is a space character.
 *
 * Ported from https://github.com/lezer-parser/markdown/blob/1.6.3/src/markdown.ts#L233
 */
export declare function isSpaceChar(char: number): boolean;
//#endregion
//#region src/ast/check-roundtrip.d.ts
/**
 * How faithfully markdown survives a parse-then-serialize round trip:
 * - `exact`: byte-identical (modulo the trailing newline).
 * - `normalizing`: bytes differ, but only as layout the parser reads back
 *   through - every content line survives and the output re-parses to the same
 *   document (e.g. a lazy continuation re-indented, or `>>>>>>> x` respaced to
 *   the seven blockquotes it already meant).
 * - `lossy`: content changed - a content line differs or disappeared, or the
 *   output re-parses to a different document.
 */
type RoundTripFidelity = 'exact' | 'normalizing' | 'lossy';
/**
 * Options for {@link checkRoundTrip}.
 */
interface CheckRoundTripOptions {
  /**
   * Whether to handle a leading `---` frontmatter block. Off by default.
   */
  frontmatter?: boolean | undefined;
}
/**
 * Classify how `markdown` survives the parse-then-serialize round trip. The
 * editor reads and writes through the same two functions, so this is also how
 * faithfully it would save the text back.
 */
export declare function checkRoundTrip(markdown: string, options?: CheckRoundTripOptions): RoundTripFidelity;
//#endregion
//#region src/ast/types.d.ts
/**
 * A block tree whose inline values contain literal Markdown, including marks.
 */
interface MarkdownDocument {
  type: 'document';
  /**
   * YAML body without fences. Undefined means absent; an empty string is an empty block.
   */
  frontmatter?: string | undefined;
  children: MarkdownBlock[];
}
/**
 * Offsets into the source given to `parseMarkdownAst`: from the node's first
 * character to its last, markers and fences included. A blank line is an empty
 * paragraph whose `from` and `to` both sit at the end of that line; an empty
 * table cell sits at the pipe that closes it.
 */
interface MarkdownPosition {
  from: number;
  to: number;
}
/**
 * Every block, table row, and table cell from the parser has a position. Nodes
 * built by the editor or by hand have none.
 */
interface MarkdownPositioned {
  position?: MarkdownPosition | undefined;
}
/**
 * Raw inline Markdown. Changing `value` invalidates an adapter's recorded segments.
 */
interface MarkdownInline extends MarkdownPositioned {
  value: string;
  /**
   * Optional editor text boundaries. Undefined chunks are non-text inline nodes,
   * which emit no text but can prevent an empty block or an HTML continuation.
   * Used only while `value` equals the recorded value; parsers need not supply it.
   */
  segments?: {
    value: string;
    chunks: Array<string | undefined>;
    /**
     * Descendant text, including inline atoms, for table cell serialization.
     */
    textContent?: string | undefined;
  } | undefined;
  children?: undefined;
}
interface MarkdownParagraph extends MarkdownInline {
  type: 'paragraph';
}
interface MarkdownHeading extends MarkdownInline {
  type: 'heading';
  level: number;
  /**
   * Length of the setext underline; absent for ATX headings.
   */
  setextUnderline?: number | undefined;
  /**
   * Number of optional closing ATX hashes.
   */
  closingHashes?: number | undefined;
}
interface MarkdownBlockquote extends MarkdownPositioned {
  type: 'blockquote';
  children: MarkdownBlock[];
}
/**
 * One item, not a list wrapper. Adjacent items form a run; nested items are children.
 * For `+   [X] **buy**`, kind is task, marker is '+', markerGap is 3,
 * checked is true, taskMarker is 'X', and the first paragraph's value is '**buy**'.
 */
interface MarkdownListItem extends MarkdownPositioned {
  type: 'listItem';
  kind: 'bullet' | 'ordered' | 'task';
  /**
   * The number an ordered list starts at, defaulting to 1. Only the first item
   * of a list carries it: the items after it count up from there.
   */
  order?: number | undefined;
  checked: boolean;
  /**
   * A folded bullet emits '+'. Task folding is not persisted.
   */
  collapsed: boolean;
  marker?: '.' | ')' | '-' | '*' | '+' | undefined;
  taskMarker?: 'x' | 'X' | undefined;
  /**
   * Spaces after the list marker, clamped to 1–4 when serialized.
   */
  markerGap?: number | undefined;
  /**
   * Never empty: an item with no content holds one empty paragraph.
   */
  children: MarkdownBlock[];
}
interface MarkdownCodeBlock extends MarkdownPositioned {
  type: 'codeBlock';
  value: string;
  language: string;
  /**
   * Absent means backticks. Dollar fences require language 'math'.
   */
  fenceStyle?: 'tilde' | 'indented' | 'dollar' | undefined;
  /**
   * Minimum opening fence width; content can require a wider fence.
   */
  fenceLength?: number | undefined;
  children?: undefined;
}
interface MarkdownHorizontalRule extends MarkdownPositioned {
  type: 'horizontalRule';
  /**
   * Original spelling, defaulting to '---'.
   */
  marker?: string | undefined;
  children?: undefined;
}
interface MarkdownHTMLComment extends MarkdownPositioned {
  type: 'htmlComment';
  /**
   * Includes the comment delimiters.
   */
  value: string;
  children?: undefined;
}
interface MarkdownTable extends MarkdownPositioned {
  type: 'table';
  children: MarkdownTableRow[];
}
interface MarkdownTableRow extends MarkdownPositioned {
  type: 'tableRow';
  children: MarkdownTableCell[];
}
interface MarkdownTableCell extends MarkdownPositioned {
  type: 'tableCell';
  header: boolean;
  align?: 'left' | 'center' | 'right' | undefined;
  children: MarkdownBlock[];
}
/**
 * An unsupported editor block: omitted from output, but separates list runs.
 */
interface MarkdownIgnored extends MarkdownPositioned {
  type: 'ignored';
  /**
   * Descendant text, used if the node occurs inside a table cell.
   */
  value: string;
  /**
   * Whether the original node contains children.
   */
  hasContent: boolean;
  children?: undefined;
}
/**
 * A standalone editor text node. Block parsers never produce this type.
 */
interface MarkdownText extends MarkdownPositioned {
  type: 'text';
  value: string;
  children?: undefined;
}
type MarkdownBlock = MarkdownParagraph | MarkdownHeading | MarkdownBlockquote | MarkdownListItem | MarkdownCodeBlock | MarkdownHorizontalRule | MarkdownHTMLComment | MarkdownTable | MarkdownIgnored | MarkdownText;
type MarkdownNode = MarkdownDocument | MarkdownBlock | MarkdownTableRow | MarkdownTableCell;
//#endregion
//#region src/ast/equal.d.ts
/**
 * Whether two trees hold the same nodes with the same fields, level by level.
 * An absent optional field equals one set to `undefined`. Positions are not
 * compared.
 */
export declare function isMarkdownAstEqual(a: MarkdownNode, b: MarkdownNode): boolean;
//#endregion
//#region src/ast/parse.d.ts
interface ParseMarkdownAstOptions {
  /**
   * Extract a leading YAML frontmatter block. Off by default.
   */
  frontmatter?: boolean | undefined;
}
/**
 * Parse Markdown blocks, retaining inline syntax as literal strings. `\r\n` and
 * `\r` are read as `\n`, and positions index the text with `\n` line endings.
 */
export declare function parseMarkdownAst(markdown: string, options?: ParseMarkdownAstOptions): MarkdownDocument;
//#endregion
//#region src/ast/serialize.d.ts
/**
 * Options for {@link serializeMarkdownAst}.
 */
interface SerializeMarkdownAstOptions {
  /**
   * Whether to serialize the doc's `frontmatter` attribute as a leading `---` block. Off by default.
   */
  frontmatter?: boolean | undefined;
}
/**
 * Serialize a block AST using Meowdown's normalization rules, not a lossless source printer.
 *
 * Performance design:
 * - Output accumulates in a `string[]` buffer; joined once at the end.
 *   Avoids per-block intermediate strings while keeping the
 *   function-per-node-type readability of a switch dispatch.
 * - Indent stack lives as a mutable `linePrefix` on the buffer object,
 *   restored via local variables across nested calls - no fresh
 *   context objects per recursion.
 * - Inline strings are written directly; optional editor segments retain
 *   continuation behavior across text boundaries.
 * - Backtick fence width and cell escaping use single linear loops, no
 *   regex on the hot path.
 */
export declare function serializeMarkdownAst(node: MarkdownNode, options?: SerializeMarkdownAstOptions): string;
//#endregion
//#region src/ast/path.d.ts
/**
 * Child indexes from the document root. Valid only for the tree that produced them.
 */
type MarkdownAstPath = readonly number[];
/**
 * A node and its address in a depth-first traversal; the root has no parent or index.
 * For `+ [ ] parent\n  + [ ] child`, the child item has path `[0, 1]`,
 * parent equal to the outer item, and index `1` (after its paragraph at `0`).
 * Node references remain usable during edits; paths and indexes must be recomputed
 * after inserting, removing, or moving siblings. Do not mutate during traversal.
 */
interface MarkdownAstEntry {
  node: MarkdownNode;
  parent: MarkdownNode | undefined;
  index: number | undefined;
  path: MarkdownAstPath;
}
/**
 * Visit the root and every descendant, including table rows and cells, in document order.
 */
export declare function walkMarkdownAst(root: MarkdownNode): Generator<MarkdownAstEntry>;
/**
 * Resolve an address against its original tree; malformed or missing addresses return undefined.
 */
export declare function resolveMarkdownAstPath(root: MarkdownNode, path: MarkdownAstPath): MarkdownAstEntry | undefined;
//#endregion
export { type CheckRoundTripOptions, type EmbedKind, type InlineElement, type LezerNodeName, type MarkdownAstEntry, type MarkdownAstPath, type MarkdownBlock, type MarkdownBlockquote, type MarkdownCodeBlock, type MarkdownDocument, type MarkdownHTMLComment, type MarkdownHeading, type MarkdownHorizontalRule, type MarkdownIgnored, type MarkdownInline, type MarkdownListItem, type MarkdownNode, type MarkdownParagraph, type MarkdownParser, type MarkdownPosition, type MarkdownPositioned, type MarkdownTable, type MarkdownTableCell, type MarkdownTableRow, type MarkdownText, type ParseMarkdownAstOptions, type RoundTripFidelity, type SerializeMarkdownAstOptions, type SyntaxNode, type Tree, type TreeCursor, parseXPostId };