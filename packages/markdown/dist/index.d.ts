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
export { type EmbedKind, type InlineElement, type LezerNodeName, type MarkdownParser, type SyntaxNode, type Tree, type TreeCursor, parseXPostId };