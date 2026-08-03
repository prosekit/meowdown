import { Editor, Extension, ExtractMarkBuilders, ExtractNodeBuilders, PlainExtension, Priority, Union, withPriority } from "@prosekit/core";
import { CodeBlockAttrs, CodeBlockAttrs as CodeBlockAttrs$1, defineCodeBlockPreviewPlugin, isCodeBlockPreviewHiddenDecoration } from "@prosekit/extensions/code-block";
import { PlaceholderOptions, definePlaceholder } from "@prosekit/extensions/placeholder";
import { defineReadonly } from "@prosekit/extensions/readonly";
import { SearchStatus, SearchStatusHandler, defineSearchStatusHandler, getSearchStatus } from "@prosekit/extensions/search";
import { Command, EditorState, PluginKey } from "@prosekit/pm/state";
import { EditorView } from "@prosekit/pm/view";
import { EditorNode, Mark, ProseMirrorNode } from "@prosekit/pm/model";
import { ListAttrs } from "@prosekit/extensions/list";
import { HorizontalRuleExtension } from "@prosekit/extensions/horizontal-rule";
import { render } from "katex";
import { VirtualElement } from "@floating-ui/dom";
//#region src/converters/check-roundtrip.d.ts
/**
 * How faithfully markdown survives a parse-then-serialize round trip:
 * - `exact`: byte-identical (modulo the trailing newline).
 * - `normalizing`: bytes differ, but only as layout the parser collapses back -
 *   no non-blank line content is lost and re-parsing the output yields the same
 *   doc (e.g. a lazy continuation re-indented to its canonical column, or a
 *   table delimiter row rewritten to canonical dashes).
 * - `lossy`: content changed - a non-blank line differs, or the re-parsed doc does.
 */
type RoundTripFidelity = 'exact' | 'normalizing' | 'lossy';
/** Options for {@link checkRoundTrip}. */
interface CheckRoundTripOptions {
  /** Whether to handle a leading `---` frontmatter block. Off by default. */
  frontmatter?: boolean;
}
/** Classify how `markdown` survives the editor's parse-then-serialize round trip. */
declare function checkRoundTrip(markdown: string, options?: CheckRoundTripOptions): RoundTripFidelity;
//#endregion
//#region src/extensions/frontmatter.d.ts
/**
 * The raw YAML frontmatter body, stored verbatim (the text between the opening
 * and closing `---` fences, without a trailing newline).
 *
 * - `null` means the document has no frontmatter (the default).
 * - `''` means an empty frontmatter block (`---\n---`).
 * - any other string is the body, which may contain newlines.
 */
type Frontmatter = string | null;
//#endregion
//#region src/extensions/list.d.ts
/**
 * The marker for a list item.
 *
 * For ordered list items, the marker is `.` or `)`.
 * For bullet and task list items, the marker is `-`, `*`, or `+`.
 * For a task list item, the marker `+` renders a circle checkbox, while the other markers render a square checkbox.
 *
 * Defaults to null if unknown.
 */
type ListMarker = '.' | ')' | '-' | '*' | '+' | null;
/**
 * The character inside a checked task's checkbox.
 *
 * GFM marks a box checked with either `x` or `X`. Defaults to null, which the
 * serializer emits as the canonical lowercase `x`.
 */
type TaskMarker = 'x' | 'X' | null;
interface MeowdownListAttrs extends ListAttrs {
  marker?: ListMarker;
  taskMarker?: TaskMarker;
  markerGap?: number;
}
//#endregion
//#region src/extensions/table-column-align.d.ts
/**
 * Column alignment of a GFM table, encoded by the delimiter row: `:--` for
 * left, `:-:` for center, `--:` for right.
 */
type TableColumnAlign = 'left' | 'center' | 'right';
interface MeowdownTableCellAttrs {
  /**
   * The column alignment this cell renders with. Defaults to null, which
   * renders with the default left alignment and serializes the delimiter
   * column as `---`.
   */
  align?: TableColumnAlign | null;
}
type TableCellAlignExtension = Extension<{
  Nodes: {
    tableCell: MeowdownTableCellAttrs;
  };
}>;
type TableHeaderCellAlignExtension = Extension<{
  Nodes: {
    tableHeaderCell: MeowdownTableCellAttrs;
  };
}>;
/**
 * The column alignment of the table column the selection sits in, or
 * undefined when the selection is outside a table or the column has no
 * alignment.
 */
declare function getTableColumnAlign(state: EditorState): TableColumnAlign | undefined;
type TableColumnAlignCommandsExtension = Extension<{
  Commands: {
    setTableColumnAlign: [align: TableColumnAlign | null];
  };
}>;
type TableColumnAlignExtension = Union<[TableCellAlignExtension, TableHeaderCellAlignExtension, PlainExtension, TableColumnAlignCommandsExtension]>;
//#endregion
//#region src/extensions/code-block.d.ts
type CodeBlockFenceStyle = 'tilde' | 'indented' | 'dollar';
interface MeowdownCodeBlockAttrs extends CodeBlockAttrs$1 {
  /**
   * How the code block was written in the source: a tilde fence (`~~~`), an
   * indented block (four leading spaces), or a `$$` math fence. `null` (the
   * default) is a backtick fence, so a block created in the editor serializes
   * to the canonical form.
   */
  fenceStyle?: CodeBlockFenceStyle | null;
  /**
   * The number of characters in the opening fence, kept only when it exceeds
   * CommonMark's three-character minimum. `null` (the default) lets the
   * serializer pick the shortest fence the content allows.
   */
  fenceLength?: number | null;
}
//#endregion
//#region src/extensions/horizontal-rule.d.ts
interface MeowdownHorizontalRuleAttrs {
  /**
   * The literal markdown marker of a thematic break, e.g. `***`, `___`, or
   * `- - -`. Defaults to null, which the serializer emits as the canonical `---`.
   */
  marker?: string | null;
}
type HorizontalRuleMarkerExtension = Extension<{
  Nodes: {
    horizontalRule: MeowdownHorizontalRuleAttrs;
  };
}>;
type MeowdownHorizontalRuleExtension = Union<[HorizontalRuleExtension, HorizontalRuleMarkerExtension]>;
//#endregion
//#region src/extensions/html-comment.d.ts
interface MeowdownHTMLCommentAttrs {
  /**
   * The literal markdown comment, including its delimiters, e.g.
   * `<!-- reflect-capture-page-text:start -->`. A multi-line comment keeps its
   * embedded newlines verbatim so the round-trip is lossless.
   */
  content: string;
}
type HTMLCommentExtension = Extension<{
  Nodes: {
    htmlComment: MeowdownHTMLCommentAttrs;
  };
}>;
/**
 * A block-level HTML comment (`<!-- ... -->`) as an invisible, atomic node.
 *
 * Markdown is the source of truth, so a comment must survive a round-trip, but
 * a comment is, by definition, not rendered output. Rather than spilling the raw
 * `<!-- ... -->` into a paragraph (where it reads as body text), the parser maps
 * a `CommentBlock` onto this node: the text rides on the `content` attribute and
 * `toDOM` hides it with `display: none`, so it stays in the document and
 * serializes back verbatim while never showing in the editor. Useful for
 * sentinel markers that tools embed around a region of a note.
 *
 * Only block-level comments (a `<!-- ... -->` that owns its line) become this
 * node. An inline comment in the middle of a paragraph is left as literal text,
 * and raw HTML blocks (`<div>…`) stay visible paragraphs — they can carry
 * content a reader expects to see.
 *
 * The node is `atom` (no editable content) and not selectable: it is an opaque,
 * invisible marker the cursor steps over rather than a block the user edits.
 */
declare function defineHTMLComment(): HTMLCommentExtension;
//#endregion
//#region src/extensions/inline-marks.d.ts
/**
 * Attributes of the `mdImage` mark, derived from either `![alt](src "title")`
 * (plus an optional trailing size comment) or a resolved wiki image embed.
 */
interface MdImageAttrs {
  /** The image destination, exactly as written in the source. */
  src: string;
  /** The image alt text. */
  alt: string;
  /** The image title, or `''` when the source has none. */
  title: string;
  /** Display width in CSS pixels from the trailing comment, or `null`. */
  width: number | null;
  /** Display height in CSS pixels from the trailing comment, or `null`. */
  height: number | null;
  /** `wikiEmbed` when the source is `![[target]]`; otherwise `null`. */
  syntax: 'wikiEmbed' | null;
  /** Original wiki-embed target used when persisting a resized image, or `null`. */
  wikiTarget: string | null;
}
interface MdLinkTextAttrs {
  href: string;
}
interface MdWikilinkAttrs {
  target: string;
  display: string;
}
/**
 * Attributes of the `mdFile` mark: a whole `[label](url)` link that the host's
 * `resolveFileLink` claimed as a file attachment, rendered as a file pill.
 */
interface MdFileAttrs {
  /** The link destination, exactly as written in the source. */
  href: string;
  /** The display name: the raw label slice, or the `href` basename when the label is empty. */
  name: string;
  /** The link title, or `''` when the source has none. */
  title: string;
}
/**
 * Attributes of the `mdMath` mark: a whole `$formula$` / `$$formula$$` inline
 * math expression, rendered by `MathMarkView`.
 */
interface MdMathAttrs {
  /** The TeX source between the dollar delimiters. */
  formula: string;
}
/** mdPack keys for units that store no extra data; the syntax marks carry it. */
type MdPackSimpleKey = 'bold' | 'italic' | 'code' | 'strike' | 'highlight' | 'autolink' | 'math';
/**
 * Content-derived identity of one inline syntax unit. Adjacent units of the
 * same kind are kept apart by it (so they do not merge into one mark run), and
 * it stays stable when unrelated text in the block is edited, so editing one
 * unit never re-marks the others. `data` carries the unit's parsed payload (a
 * link's `href`/`title`, an image's `src`) so callers read it off the mark
 * instead of re-parsing the text.
 */
type MdPackAttrs = {
  key: 'link';
  data: {
    href: string;
    title: string;
    reference?: true;
  };
} | {
  key: 'image';
  data: {
    src: string;
  };
} | {
  key: MdPackSimpleKey;
  data?: null;
};
//#endregion
//#region src/utils/range.d.ts
interface PositionRange {
  from: number;
  to: number;
}
//#endregion
//#region src/extensions/get-link-unit-at.d.ts
interface LinkUnit {
  /** Whole inline link, reference link, or autolink range. */
  unit: PositionRange;
  /**
   * The visible text of the link: the `[ ]` interior for a full link, the URL
   * between `< >` for an angle autolink, the whole unit for a bare autolink.
   * Popovers anchor on it; the unit's edges can sit inside hidden syntax,
   * whose collapsed glyphs measure at bogus coordinates.
   */
  text: PositionRange;
  /** Interior of `[ ]`. Absent for an autolink. */
  label?: PositionRange;
  /** Interior of `( )`. What `updateLink` rewrites. Absent for an autolink. */
  dest?: PositionRange;
  /** The link URL. Could be an empty string. */
  href: string;
  /** The link title, unquoted. Could be an empty string. */
  title: string;
}
/**
 * The link covering `pos`, with its sub-ranges (`label`, `dest`) and parsed
 * `href`/`title`. The single query the commands and the hover/click handlers
 * share, replacing the old `findLinkAt`.
 *
 * Derived entirely from the marks already on the document (no re-parse): the
 * `mdPack` unit gives the shape and carries the `href`/`title` in its `data`, and
 * the `mdLinkUri` run locates the `( )` body.
 */
declare function getLinkUnitAt(state: EditorState, pos: number): LinkUnit | undefined;
//#endregion
//#region src/extensions/link-commands.d.ts
interface LinkAttrs {
  href?: string;
  title?: string;
}
interface InsertLinkOptions {
  href?: string;
  title?: string;
  wrapText?: boolean;
}
declare function insertLink({ href, title, wrapText }?: InsertLinkOptions): Command;
/** Rewrite the `( ... )` of the link at the caret/selection. */
declare function updateLink(attrs: LinkAttrs): Command;
/** Unwrap the link at the caret: keep the label text, drop the syntax. */
declare function removeLink(): Command;
declare function defineLinkCommands(): Extension<{
  Commands: {
    insertLink: [options?: InsertLinkOptions];
    updateLink: [attrs: LinkAttrs];
    removeLink: [];
  };
}>;
interface LinkEditOptions {
  from: number;
  to: number;
  link: LinkUnit | undefined;
}
type LinkEditHandler = (options: LinkEditOptions) => void;
declare function defineLinkEditKeymap(onLinkEdit: LinkEditHandler): PlainExtension;
//#endregion
//#region src/extensions/pending-replacement.d.ts
/** Where an accepted replacement lands relative to the source range. */
type PendingReplacementMode = 'replace' | 'append';
/** How a pending replacement ended. */
type PendingReplacementOutcome = 'accepted' | 'discarded';
/**
 * A staged replacement: Markdown text accumulating over `[from, to]` that is
 * only written into the document when accepted. Until then the document is
 * untouched; discarding is a no-op.
 */
interface PendingReplacement {
  /** Start of the source range the replacement targets. */
  from: number;
  /** End of the source range the replacement targets. */
  to: number;
  /** The Markdown accumulated so far (e.g. streamed from an AI provider). */
  text: string;
  /** Whether accepting replaces the source range or inserts after its block. */
  mode: PendingReplacementMode;
}
/** The active pending replacement, or null when there is none. */
declare function getPendingReplacement(state: EditorState): PendingReplacement | null;
/** Options for the `startPendingReplacement` command. */
interface StartPendingReplacementOptions extends PositionRange {
  mode: PendingReplacementMode;
}
/** Options for the `acceptPendingReplacement` command. */
interface AcceptPendingReplacementOptions {
  /** Overrides the staged mode for this accept (e.g. "Insert below" on a replace stage). */
  mode?: PendingReplacementMode;
}
/** A pending-replacement change: text/range updates, or how the stage ended. */
type PendingReplacementEvent = {
  type: 'update';
  pending: PendingReplacement;
} | {
  type: 'ended';
  pending: PendingReplacement;
  outcome: PendingReplacementOutcome;
};
type PendingReplacementHandler = (event: PendingReplacementEvent) => void;
/**
 * Watches pending-replacement state and reports changes, so a UI layer can
 * render the preview and know whether the stage was accepted or discarded.
 */
declare function definePendingReplacementHandler(handler: PendingReplacementHandler): PlainExtension;
//#endregion
//#region src/extensions/mark-chunk.d.ts
/**
 * Contiguous range with a uniform inline-mark set.
 */
type MarkChunk = readonly [from: number, to: number, marks: readonly Mark[]];
//#endregion
//#region src/extensions/reference-links.d.ts
interface ReferenceDefinition {
  key: string;
  href: string;
  title: string;
}
type ReferenceDefinitions = ReadonlyMap<string, ReferenceDefinition>;
interface ReferenceDefinitionIndex {
  definitions: ReferenceDefinitions;
  nodes: ReadonlySet<EditorNode>;
}
declare function collectReferenceDefinitions(doc: EditorNode): ReferenceDefinitionIndex;
//#endregion
//#region src/extensions/wiki-embed.d.ts
/** The parsed source payload of an Obsidian-style `![[target]]` embed. */
interface ParsedWikiEmbed {
  /** Target before an optional alias or size suffix. */
  target: string;
  /** Non-size suffix after `|`, or `''` when absent. */
  display: string;
  /** Requested display width in CSS pixels, or `null`. */
  width: number | null;
  /** Requested display height in CSS pixels, or `null`. */
  height: number | null;
}
/** A resolved wiki embed rendered through Meowdown's existing atom views. */
type WikiEmbedResolution = {
  kind: 'image';
  /** Source passed to `resolveImageUrl` and image click handlers. Defaults to `target`. */
  src?: string;
  /** Image alt text. Defaults to the alias or target basename. */
  alt?: string;
} | {
  kind: 'file';
  /** Destination passed to file metadata and click handlers. Defaults to `target`. */
  href?: string;
  /** File pill label. Defaults to the alias or target basename. */
  name?: string;
  /** Optional file title. */
  title?: string;
} | {
  kind: 'note';
  /** Target passed to wikilink click handlers. Defaults to the source target. */
  target?: string;
  /** Chip label. Defaults to the source alias or resolved target. */
  display?: string;
};
/**
 * Classifies one wiki embed for rendering. Return `undefined` to leave the
 * source literal and editable. The resolver participates in the parse cache,
 * so it must be pure: the same payload must always return the same result.
 */
type WikiEmbedResolver = (embed: ParsedWikiEmbed) => WikiEmbedResolution | undefined;
/** Host options for wiki-embed parsing. */
interface WikiEmbedOptions {
  resolveWikiEmbed?: WikiEmbedResolver;
}
/** Parse `![[target]]`, `![[target|alias]]`, `![[target|width]]`, or `![[target|widthxheight]]`. */
declare function parseWikiEmbed(source: string): ParsedWikiEmbed;
/** Rewrite a wiki image embed with a persisted display size. */
declare function formatSizedWikiEmbed(target: string, width: number, height: number): string;
/** Last path component of a target, with a note heading/block fragment removed. */
declare function wikiEmbedBasename(target: string): string;
//#endregion
//#region src/extensions/inline-text-to-mark-chunks.d.ts
/** What {@link FileLinkResolver} sees for one `[label](url)` link. */
interface FileLinkPayload {
  /** The link destination, exactly as written in the source. */
  href: string;
  /** The raw label slice between the brackets; may be empty or contain nested syntax. */
  label: string;
  /** The link title, or `''` when the source has none. */
  title: string;
}
/**
 * Claims a `[label](url)` link as a file attachment. A claimed link carries a
 * single `mdFile` mark over its whole source (rendered as a file pill by
 * `defineFileView`) instead of the usual link marks, so link click/hover/menu
 * no longer apply to it. Must be pure: parse results are cached and diffed,
 * so the same input must always produce the same answer.
 */
type FileLinkResolver = (link: FileLinkPayload) => boolean;
/** Host options that influence inline parsing. */
interface FileLinkOptions {
  resolveFileLink?: FileLinkResolver;
}
/** Host options that influence source-backed inline atom parsing. */
type InlineMarkOptions = FileLinkOptions & WikiEmbedOptions;
interface InlineMarkContext {
  /** Effective document-wide definitions, keyed by normalized reference label. */
  referenceDefinitions?: ReferenceDefinitions;
  /** Prevent this definition block's own label from resolving as a shortcut reference. */
  isReferenceDefinition?: boolean;
  /** Receives every normalized key read by this block, including unresolved references. */
  referencedKeys?: Set<string>;
}
/**
 * Walk a textblock's inline content and produce a list of mark chunks
 * with positions relative to the start of `text` (i.e. zero-based).
 * Callers shift the chunks into the document's coordinate space.
 */
declare function inlineTextToMarkChunks(
/** Typed mark builders bound to the target schema. */
marks: TypedMarkBuilders,
/** The raw inline text of one textblock (no block prefix). */
text: string,
/** Host options; omit for the default parse. */
options?: InlineMarkOptions): MarkChunk[];
declare function inlineTextToMarkChunksWithContext(marks: TypedMarkBuilders, text: string, options?: InlineMarkOptions, context?: InlineMarkContext): MarkChunk[];
//#endregion
//#region src/extensions/mark-mode.d.ts
/**
 * Controls how markdown syntax characters are rendered and how the clipboard's
 * `text/plain` treats the inline layer (see `definePlainTextSerializer`).
 *
 * - 'hide':  syntax chars never visible; copy strips the inline syntax.
 * - 'focus': syntax chars hidden by default; revealed near cursor; copy keeps them.
 * - 'show':  syntax chars always visible (dim grey); copy keeps them.
 */
type MarkMode = 'hide' | 'focus' | 'show';
//#endregion
//#region src/extensions/extension.d.ts
declare function defineEditorExtensionImpl(options: EditorExtensionOptions): import("@prosekit/core").Union<readonly [import("@prosekit/core").Extension<{
  Nodes: import("@prosekit/core").SimplifyDeeper<{
    paragraph: import("@prosekit/pm/model").Attrs;
  }>;
  Marks: never;
  Commands: {
    setParagraph: [];
  };
}>, import("@prosekit/extensions/doc").DocExtension, import("@prosekit/core").Extension<{
  Nodes: {
    doc: {
      frontmatter?: Frontmatter;
    };
  };
}>, import("@prosekit/extensions/text").TextExtension, import("@prosekit/extensions/blockquote").BlockquoteExtension, import("@prosekit/core").Union<readonly [import("@prosekit/extensions/list").ListSpecExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/extensions/list").ListCommandsExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").Extension<{
  Nodes: {
    list: {
      marker?: ListMarker;
    };
  };
}>, import("@prosekit/core").Extension<{
  Nodes: {
    list: {
      taskMarker?: TaskMarker;
    };
  };
}>, import("@prosekit/core").Extension<{
  Nodes: {
    list: {
      markerGap?: number;
    };
  };
}>, import("@prosekit/core").Extension<{
  Commands: {
    cycleCheckableList: [];
    cycleBulletOrderedList: [];
    wrapInCircleTask: [];
    wrapInSquareTask: [];
    toggleListCollapsed: [];
  };
}>]>, import("@prosekit/core").Union<readonly [import("@prosekit/extensions/heading").HeadingSpecExtension, import("@prosekit/core").Extension<{
  Nodes: {
    heading: import("@prosekit/extensions/heading").HeadingAttrs;
  };
}>, import("@prosekit/core").Extension<{
  Nodes: {
    heading: {
      setextUnderline?: number | null;
    };
  };
}>, import("@prosekit/core").Extension<{
  Nodes: {
    heading: {
      closingHashes?: number | null;
    };
  };
}>, import("@prosekit/core").PlainExtension, import("@prosekit/extensions/heading").HeadingCommandsExtension, import("@prosekit/core").PlainExtension]>, import("@prosekit/core").Union<readonly [import("@prosekit/extensions/table").TableSpecExtension, import("@prosekit/extensions/table").TableRowSpecExtension, import("@prosekit/extensions/table").TableCellSpecExtension, import("@prosekit/extensions/table").TableHeaderCellSpecExtension, import("@prosekit/core").Union<readonly [import("@prosekit/core").Extension<{
  Nodes: {
    tableCell: import("@prosekit/pm/model").Attrs;
  };
}>, import("@prosekit/core").Extension<{
  Nodes: {
    tableHeaderCell: import("@prosekit/pm/model").Attrs;
  };
}>]>, TableColumnAlignExtension, import("@prosekit/core").PlainExtension, import("@prosekit/extensions/table").TableCommandsExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension]>, import("@prosekit/core").Union<readonly [import("@prosekit/extensions/code-block").CodeBlockExtension, import("@prosekit/core").Extension<{
  Nodes: {
    codeBlock: {
      fenceStyle?: CodeBlockFenceStyle | null;
    };
  };
}>, import("@prosekit/core").Extension<{
  Nodes: {
    codeBlock: {
      fenceLength?: number | null;
    };
  };
}>, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension]>, MeowdownHorizontalRuleExtension, import("@prosekit/core").Extension<{
  Nodes: {
    htmlComment: MeowdownHTMLCommentAttrs;
  };
}>, import("@prosekit/core").Union<readonly [import("@prosekit/core").Extension<{
  Marks: {
    mdMark: import("@prosekit/pm/model").Attrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdEm: import("@prosekit/pm/model").Attrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdStrong: import("@prosekit/pm/model").Attrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdCode: import("@prosekit/pm/model").Attrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdLinkText: MdLinkTextAttrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdLinkUri: import("@prosekit/pm/model").Attrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdLinkTitle: import("@prosekit/pm/model").Attrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdDel: import("@prosekit/pm/model").Attrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdHighlight: import("@prosekit/pm/model").Attrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdTag: import("@prosekit/pm/model").Attrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdWikilink: MdWikilinkAttrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdImage: MdImageAttrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdFile: MdFileAttrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdMath: MdMathAttrs;
  };
}>, import("@prosekit/core").Extension<{
  Marks: {
    mdPack: MdPackAttrs;
  };
}>]>, import("@prosekit/core").PlainExtension, import("@prosekit/core").Extension<import("@prosekit/core").ExtensionTyping<any, any, any>>, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").Union<readonly [import("@prosekit/core").Extension<{
  Commands: {
    toggleEm: [];
    toggleStrong: [];
    toggleCode: [];
    toggleDel: [];
    toggleHighlight: [];
  };
}>, import("@prosekit/core").PlainExtension]>, import("@prosekit/core").Extension<{
  Commands: {
    insertLink: [options?: InsertLinkOptions];
    updateLink: [attrs: LinkAttrs];
    removeLink: [];
  };
}>, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").Union<readonly [import("@prosekit/core").PlainExtension, import("@prosekit/core").Extension<{
  Commands: {
    setMarkMode: [mode: MarkMode];
  };
}>]>, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").BaseCommandsExtension, import("@prosekit/core").HistoryExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").Extension<{
  Commands: {
    insertMarkdown: [markdown: string];
    insertTrigger: [text: string];
    scrollIntoView: [];
    selectText: [anchor: number, head?: number | undefined];
    selectTextBetween: [$anchor: import("@prosekit/pm/model").ResolvedPos, $head: import("@prosekit/pm/model").ResolvedPos, bias?: number | undefined];
    turnIntoText: [];
  };
}>, import("@prosekit/core").Union<readonly [import("@prosekit/core").PlainExtension, import("@prosekit/core").Extension<{
  Commands: {
    startPendingReplacement: [options: StartPendingReplacementOptions];
    appendPendingReplacementText: [text: string];
    acceptPendingReplacement: [options?: AcceptPendingReplacementOptions | undefined];
    discardPendingReplacement: [];
  };
}>, import("@prosekit/core").PlainExtension]>, import("@prosekit/core").Union<readonly [import("@prosekit/core").PlainExtension, import("@prosekit/extensions/search").SearchCommandsExtension, import("@prosekit/core").PlainExtension]>]>;
type EditorExtension = ReturnType<typeof defineEditorExtensionImpl>;
/**
 * Options for {@link defineEditorExtension}. Creation-time configuration:
 * `resolveFileLink` and `resolveWikiEmbed` are baked into the editor's parse
 * pipeline, so changing them requires rebuilding the editor; `markMode` is
 * only the initial value.
 */
type EditorExtensionOptions = InlineMarkOptions & {
  /**
   * The initial mark mode, applied from the first paint. Defaults to
   * `'focus'`. Switch later with the `setMarkMode` command.
   */
  markMode?: MarkMode;
};
declare function defineEditorExtension(options?: EditorExtensionOptions): EditorExtension;
type TypedEditor = Editor<EditorExtension>;
//#endregion
//#region src/extensions/schema.d.ts
type TypedNodeBuilders = ExtractNodeBuilders<EditorExtension>;
type TypedMarkBuilders = ExtractMarkBuilders<EditorExtension>;
/** Typed mark builders bound to the shared schema. */
declare const getMarkBuilders: () => TypedMarkBuilders;
//#endregion
//#region src/converters/md-to-pm.d.ts
/** Options for {@link markdownToDoc}. */
interface MarkdownToDocOptions {
  /** Node builders to build the document with. Defaults to the shared schema's builders. */
  nodes?: TypedNodeBuilders;
  /** Whether to peel a leading `---` frontmatter block onto the doc's `frontmatter` attribute. Off by default. */
  frontmatter?: boolean;
}
/**
 * Convert a markdown string into a ProseMirror document node.
 *
 * By default the document is built with the shared schema's node builders, so
 * no editor is required. When the result will be loaded into a specific editor,
 * pass that editor's `nodes` so the document uses the editor's own schema
 * instance and can be inserted without a JSON round trip.
 *
 * The output follows the extension set defined in `../extensions/extension.ts`
 * (doc, paragraph, text, heading, blockquote, list, codeBlock, table, tableRow,
 * tableCell, tableHeaderCell, horizontalRule). The function does not produce
 * inline marks because the markdown stays literal text - emphasis / link /
 * inline-code characters survive verbatim.
 */
declare function markdownToDoc(markdown: string, options?: MarkdownToDocOptions): ProseMirrorNode;
//#endregion
//#region src/converters/pm-to-md.d.ts
/** Options for {@link docToMarkdown}. */
interface DocToMarkdownOptions {
  /** Whether to serialize the doc's `frontmatter` attribute as a leading `---` block. Off by default. */
  frontmatter?: boolean;
}
/**
 * Convert a ProseMirror document into a Markdown string.
 *
 * Performance design:
 * - Output accumulates in a `string[]` buffer; joined once at the end.
 *   Avoids per-block intermediate strings while keeping the
 *   function-per-node-type readability of a switch dispatch.
 * - Indent stack lives as a mutable `linePrefix` on the buffer object,
 *   restored via local variables across nested calls - no fresh
 *   context objects per recursion.
 * - Inline content is walked directly (not via `node.textContent`) to
 *   skip one intermediate string allocation per leaf block.
 * - Backtick fence width and cell escaping use single linear loops, no
 *   regex on the hot path.
 */
declare function docToMarkdown(node: ProseMirrorNode, options?: DocToMarkdownOptions): string;
//#endregion
//#region src/extensions/bullet-after-heading.d.ts
/**
 * "Type a title, press Return, start bullets." When this extension is applied,
 * pressing Enter at the end of the document's first heading (the title line)
 * drops the caret into a fresh empty bullet instead of a plain paragraph.
 */
declare function defineBulletAfterHeading(): PlainExtension;
//#endregion
//#region src/extensions/code-block-highlight.d.ts
/**
 * Adds syntax highlighting to `codeBlock` nodes, parsing each block with the
 * matching CodeMirror/Lezer grammar (loaded on demand from
 * `@codemirror/language-data`). Tokens are tagged with `@lezer/highlight`
 * `tok-*` classes; the default theme colors them per color scheme.
 */
declare function defineCodeBlockSyntaxHighlight(): Extension;
/** A highlighted span of code: `[from, to)` carries the `@lezer/highlight` classes. */
type CodeToken = readonly [from: number, to: number, classes: string];
/**
 * Highlight `code` in `language` into `tok-*` token spans, the same classes the
 * editor's decorations use. Returns synchronously when the grammar is already
 * loaded (the common path, no render flash), and a `Promise` only when a grammar
 * must load on demand. Returns `[]` for an empty or unsupported language.
 */
declare function getCodeTokens(code: string, language: string): CodeToken[] | Promise<CodeToken[]>;
//#endregion
//#region src/extensions/code-block-languages.d.ts
type LanguageItem = {
  label: string;
  value: string;
};
/**
 * A list of languages for code block syntax-highlight.
 */
declare const codeBlockLanguages: ReadonlyArray<LanguageItem>;
//#endregion
//#region src/extensions/embed-paste.d.ts
/**
 * Auto-embed a pasted tweet or YouTube link. When the clipboard holds exactly
 * one such URL, the link is rewritten to `![](url)`, which the image pipeline
 * renders as a rich embed. Not part of `defineEditorExtension`; the React
 * package applies it via the `embedPaste` prop (on by default).
 */
declare function defineEmbedPaste(): PlainExtension;
//#endregion
//#region src/extensions/embed-types.d.ts
/**
 * A framework-agnostic description of an embed iframe. Both the editor's DOM
 * mark view and the static React renderer build their own `<iframe>` from it, so
 * the URL/attribute logic lives in one place while each side renders natively.
 */
interface EmbedDescriptor {
  readonly kind: 'tweet' | 'youtube';
  /**
   * Stable identity for the widget, unique per rendered embed (e.g. the video or
   * tweet id). Keeps ProseMirror from rebuilding the iframe on every edit, and
   * keys the React element, so the embed never reloads.
   */
  readonly key: string;
  /** The iframe `src`. */
  readonly src: string;
  /** The iframe `title`. */
  readonly title: string;
  /** The iframe `class`, e.g. `md-embed md-embed-tweet`. */
  readonly className: string;
  /** The iframe `data-testid`. */
  readonly testid: string;
  /** The iframe `allow` policy, when the embed needs one. */
  readonly allow?: string;
  /** Whether the iframe is fullscreen-capable. */
  readonly allowFullscreen?: boolean;
}
//#endregion
//#region src/extensions/tweet.d.ts
/**
 * `Tweet.html` reports its rendered height via `postMessage`; size the iframe to
 * fit and pass each reported height to `onHeight`. Returns a cleanup that
 * removes the listener. The cleanup also runs once the iframe leaves the DOM, so
 * the editor's DOM mark view (which has no destroy hook) is covered, while a
 * React caller can call it on unmount.
 */
declare function listenForTweetHeight(iframe: HTMLIFrameElement, onHeight?: (height: number) => void): () => void;
//#endregion
//#region src/extensions/embed.d.ts
/** Detect a tweet/YouTube embed in an image `src`, or `undefined` for a plain image. */
declare function matchEmbed(src: string): EmbedDescriptor | undefined;
//#endregion
//#region src/extensions/exit-boundary.d.ts
/** Payload for {@link ExitBoundaryHandler}. */
interface ExitBoundaryOptions {
  /** The boundary the caret would leave: `up` at the document start, `down` at the end. */
  direction: 'up' | 'down';
  /** The originating arrow key press. */
  event: KeyboardEvent;
}
/**
 * Called when an arrow key press would move the caret past the document
 * boundary. Return `false` to let the editor handle the key normally; any
 * other return value consumes it.
 */
type ExitBoundaryHandler = (options: ExitBoundaryOptions) => boolean | void;
/** Call `onExitBoundary` when an arrow key press would leave the document boundary. */
declare function defineExitBoundaryHandler(onExitBoundary: ExitBoundaryHandler): PlainExtension;
//#endregion
//#region src/extensions/file-click.d.ts
/** Payload for {@link FileClickHandler}. */
interface FileClickPayload {
  /** The resolved destination from `[name](href)` or a claimed `![[target]]`. */
  href: string;
  /** The file name shown on the pill. */
  name: string;
  /**
   * The originating click, or the `Enter`/`Mod-Enter` key press that followed the
   * pill. Read modifier keys or position a popover from it.
   */
  event: MouseEvent | KeyboardEvent;
}
type FileClickHandler = (payload: FileClickPayload) => void;
/**
 * Call `onClick` when the user clicks a rendered file pill, with the file's
 * `href`, `name`, and the originating `MouseEvent`. The host decides what a
 * click does (e.g. open the file in the OS default app).
 */
declare function defineFileClickHandler(onClick: FileClickHandler): PlainExtension;
//#endregion
//#region src/extensions/file-paste.d.ts
type FilePasteHandler = (file: File) => string | undefined | Promise<string | undefined>;
type FileSaveErrorHandler = (error: unknown, file: File) => void;
/** Options for {@link defineFilePaste}. */
interface FilePasteOptions {
  /**
   * Persist a pasted/dropped file and return its markdown destination, or
   * `undefined` to decline (nothing is inserted, but the event is consumed).
   * An image (`image/*` MIME type or a recognized image filename extension)
   * inserts `![](src)`; any other file inserts a `[name](src)` link.
   */
  onFilePaste?: FilePasteHandler;
  /** Called when persisting a pasted/dropped file throws. Defaults to `console.error`. */
  onFileSaveError?: FileSaveErrorHandler;
}
/**
 * The markdown a saved file becomes: `![](destination)` for an image (a
 * `type` starting with `image/` or a recognized image filename extension), a
 * `[name](destination)` link otherwise, with `\`, `[`, and `]` escaped in the
 * name. Exported so a host command that inserts file links itself (e.g. an
 * attach-file picker) produces markdown byte-identical to a paste/drop.
 */
declare function buildFileMarkdown(file: {
  name: string;
  type?: string;
}, destination: string): string;
/**
 * Persist pasted/dropped files via `onFilePaste` and insert the returned
 * markdown destination: `![](src)` for an image, a `[name](src)` link for any
 * other file. Multiple files insert one link per line, in DataTransfer order.
 */
declare function defineFilePaste(options?: FilePasteOptions): PlainExtension;
//#endregion
//#region src/extensions/file-view.d.ts
/** Metadata a host resolves for one file link, shown on its pill. */
interface FileInfo {
  /** File size in bytes, shown as a human-readable suffix (e.g. `1.4 MB`). */
  size?: number;
}
/**
 * Resolve display metadata for a file `href`, directly or as a promise; the
 * pill renders immediately and fills the metadata in when the promise
 * settles. Return `undefined` for a file without metadata (e.g. one that no
 * longer exists). Called once per rendered pill, so the same `href` may
 * resolve repeatedly: cache in the host when resolving is expensive.
 */
type FileInfoResolver = (href: string) => FileInfo | undefined | Promise<FileInfo | undefined>;
/** Options for {@link defineFileView}. */
interface FileViewOptions {
  /** Resolve the metadata (file size) shown on a pill. Omit to show none. */
  resolveFileInfo?: FileInfoResolver;
}
/** Classify a file destination for the pill's `data-file-kind` attribute. */
declare function getFileKind(href: string): string;
/**
 * Render a claimed file link or wiki embed (the `mdFile` mark) as an inline
 * pill: a file-kind icon, the file name, and the size once
 * `resolveFileInfo` supplies it. The pill never loads the file's content;
 * clicks are reported through `defineFileClickHandler`.
 */
declare function defineFileView(options?: FileViewOptions): PlainExtension;
//#endregion
//#region src/extensions/link-click.d.ts
interface LinkClickPayload {
  href: string;
  /** The originating click, or the `Enter`/`Mod-Enter` key press that followed the link. */
  event: MouseEvent | KeyboardEvent;
}
type LinkClickHandler = (payload: LinkClickPayload) => void;
interface LinkCopyPayload {
  href: string;
}
type LinkCopyHandler = (payload: LinkCopyPayload) => void;
declare function defineLinkClickHandler(onClick: LinkClickHandler): PlainExtension;
//#endregion
//#region src/extensions/tag-click.d.ts
interface TagClickPayload {
  /** The tag name, without the leading `#`. */
  tag: string;
  /**
   * The originating click, or the `Enter`/`Mod-Enter` key press that followed the tag.
   * Read modifier keys or position a popover from it.
   */
  event: MouseEvent | KeyboardEvent;
}
type TagClickHandler = (payload: TagClickPayload) => void;
declare function defineTagClickHandler(onClick: TagClickHandler): PlainExtension;
//#endregion
//#region src/extensions/wikilink-click.d.ts
interface WikilinkHit {
  from: number;
  to: number;
  target: string;
}
interface WikilinkClickPayload {
  target: string;
  /** The originating click, or the `Enter`/`Mod-Enter` key press that followed the link. */
  event: MouseEvent | KeyboardEvent;
}
type WikilinkClickHandler = (payload: WikilinkClickPayload) => void;
declare function defineWikilinkClickHandler(onClick: WikilinkClickHandler): PlainExtension;
//#endregion
//#region src/extensions/follow-link.d.ts
interface FollowLinkHandlers {
  onWikilinkClick?: WikilinkClickHandler;
  onTagClick?: TagClickHandler;
  onFileClick?: FileClickHandler;
  onLinkClick?: LinkClickHandler;
}
/**
 * Binds `Mod-Enter` to follow the wikilink, tag, file pill, or Markdown link
 * under the caret, and plain `Enter` to follow a selected atom unit, firing
 * the same handlers a click does. Off a link, `Mod-Enter` falls through so
 * the list keymap keeps cycling checkbox tasks; off a selected unit, `Enter`
 * falls through to the regular split. High priority puts this ahead of every
 * keymap binding.
 */
declare function defineFollowLinkHandler(handlers: FollowLinkHandlers): PlainExtension;
//#endregion
//#region src/extensions/image-click.d.ts
/** Payload for {@link ImageClickHandler}. */
interface ImageClickPayload {
  /** The resolved source from `![alt](src)` or a claimed `![[target]]`. */
  src: string;
  /** The image alt text. */
  alt: string;
  /**
   * The originating click or touch tap. Read the target or position a popover
   * from it; a touch surface delivers the `touchend` instead of a click.
   */
  event: MouseEvent | TouchEvent;
}
type ImageClickHandler = (payload: ImageClickPayload) => void;
/**
 * Call `onClick` when the user clicks or taps a rendered image preview, with
 * the image's markdown `src`, `alt`, and the originating event.
 *
 * Touch taps are handled from `touchend` rather than the synthetic click:
 * previews live inside the editor contenteditable, and iOS WebKit's
 * tap-to-focus is a native gesture default action that only cancelling the
 * `touchend` can suppress — otherwise a tap briefly focuses the editor and
 * raises the software keyboard before the handler opens its own surface
 * (such as a lightbox).
 */
declare function defineImageClickHandler(onClick: ImageClickHandler): PlainExtension;
//#endregion
//#region src/extensions/image.d.ts
type ImageUrlResolver = (src: string) => string | undefined;
/** Options for {@link defineImage}. */
interface ImageOptions {
  /**
   * Map a markdown `src` to a displayable URL, or `undefined` to skip rendering
   * that image. Defaults to `defaultResolveImageUrl`.
   */
  resolveImageUrl?: ImageUrlResolver;
  /**
   * Whether to write the height a tweet embed reports back into the trailing
   * size comment, so the next load can seed the iframe at its final height.
   * Defaults to `true`; disable when the document must never change without a
   * user edit (e.g. deterministic tests).
   */
  persistTweetHeight?: boolean;
}
/** Show an `src` as-is when it is an http(s) URL, otherwise skip rendering it. */
declare function defaultResolveImageUrl(src: string): string | undefined;
/** Inline image/embed rendering: a mark view on the `mdImage` mark. */
declare function defineImage(options?: ImageOptions): PlainExtension;
//#endregion
//#region src/extensions/key-bindings.d.ts
/** Human-readable descriptions of the editor's formatting and heading shortcuts. */
declare const EDITOR_KEY_BINDINGS: {
  readonly 'Mod-b': "Bold";
  readonly 'Mod-i': "Italic";
  readonly 'Mod-e': "Inline code";
  readonly 'Mod-Shift-x': "Strikethrough";
  readonly 'Mod-Shift-h': "Highlight";
  readonly 'Mod-k': "Link";
  readonly 'Mod-Shift-k': "Insert a wikilink";
  readonly 'Mod-1': "Heading 1";
  readonly 'Mod-2': "Heading 2";
  readonly 'Mod-3': "Heading 3";
  readonly 'Mod-4': "Heading 4";
  readonly 'Mod-5': "Heading 5";
  readonly 'Mod-6': "Heading 6";
  readonly 'Mod-.': "Fold or unfold a bullet";
  readonly 'Mod-Enter': "Follow the link under the caret, or cycle a checkbox task";
  readonly 'Mod-Shift-Enter': "Cycle a circle checkbox task";
  readonly 'Mod-Shift-7': "Ordered list";
  readonly 'Mod-Shift-8': "Bullet list";
  readonly 'Mod-Shift-9': "Checkbox task list";
  readonly 'Alt-ArrowUp': "Move the block or list item up";
  readonly 'Alt-ArrowDown': "Move the block or list item down";
  readonly 'Meta-ArrowUp': "Move the caret to the document start";
  readonly 'Meta-ArrowDown': "Move the caret to the document end";
  readonly 'Shift-Meta-ArrowUp': "Select to the document start";
  readonly 'Shift-Meta-ArrowDown': "Select to the document end";
  readonly Escape: "Collapse the selection";
};
//#endregion
//#region src/extensions/mark-hover.d.ts
interface MarkHoverHit<Payload> {
  payload: Payload;
  element: HTMLElement;
}
//#endregion
//#region src/extensions/link-hover.d.ts
type LinkHoverHandler = (hit: MarkHoverHit<LinkUnit> | undefined) => void;
declare function defineLinkHoverHandler(onHoverChange: LinkHoverHandler): PlainExtension;
//#endregion
//#region src/extensions/link-paste.d.ts
/**
 * Paste a URL over selected text to wrap the selection as a Markdown link
 * `[selected text](url)`. Only fires when the clipboard holds exactly one URL
 * and the selection is a non-empty text selection inside a single non-code
 * textblock; otherwise the paste falls through to the other handlers
 * (embed paste, plain paste). One undo restores the plain selected text.
 *
 * Registered with `Priority.high` so its `handlePaste` runs before
 * `defineEmbedPaste`'s: pasting an embeddable URL (tweet/YouTube) over a
 * selection keeps the selected text as a link instead of discarding it for an
 * embed. Not part of `defineEditorExtension`; the React package applies it via
 * the `linkPaste` prop (on by default).
 */
declare function defineLinkPaste(): PlainExtension;
//#endregion
//#region src/extensions/mark-names.d.ts
declare const MARK_NAMES: readonly ["mdWikilink", "mdImage", "mdFile", "mdMath", "mdMark", "mdEm", "mdStrong", "mdCode", "mdLinkText", "mdLinkUri", "mdLinkTitle", "mdDel", "mdHighlight", "mdTag", "mdPack"];
type MarkName = (typeof MARK_NAMES)[number];
declare function isMarkOfType(mark: Mark, name: MarkName): boolean;
//#endregion
//#region src/extensions/math.d.ts
/** Inline math rendering: a KaTeX preview on the `mdMath` mark. */
declare function defineMath(): PlainExtension;
//#endregion
//#region src/extensions/node-names.d.ts
/**
 * Every ProseMirror node name the editor schema knows about.
 */
declare const NODE_NAMES: readonly ["doc", "text", "paragraph", "heading", "blockquote", "list", "codeBlock", "horizontalRule", "htmlComment", "table", "tableRow", "tableCell", "tableHeaderCell"];
type NodeName = (typeof NODE_NAMES)[number];
declare function isNodeOfType(node: ProseMirrorNode, name: NodeName): boolean;
//#endregion
//#region src/extensions/spell-check.d.ts
declare function defineSpellCheckPlugin(spellCheck: boolean): PlainExtension;
//#endregion
//#region src/extensions/substitution.d.ts
/** Apply the editor's automatic plain-text substitutions. */
declare function defineSubstitution(): PlainExtension;
//#endregion
//#region src/extensions/table.d.ts
/**
 * Whether the selection sits inside a table cell (data or header). Useful for
 * gating block-creating UI, since cells hold inline content only.
 */
declare function isSelectionInTableCell(state: EditorState): boolean;
//#endregion
//#region src/extensions/view-attributes.d.ts
/**
 * Add DOM attributes to the editable root. `class` and `style` values from
 * every such extension are combined, so applying this more than once adds
 * classes instead of replacing them.
 */
declare function defineViewAttributes(attributes: {
  [name: string]: string;
} | ((state: EditorState) => {
  [name: string]: string;
})): PlainExtension;
//#endregion
//#region src/extensions/virtual-caret.d.ts
/**
 * Draws the caret as an overlay element and hides the native caret via CSS
 * (`caret-color: transparent`). The native DOM selection stays fully alive,
 * so IME, clicks, and typing keep their native behavior; only the caret pixels
 * are ours. Applies to every mark mode.
 *
 * `layer` is the element the caret draws into. The host owns its placement:
 * it must live outside the contenteditable and scroll together with the
 * content.
 */
declare function defineVirtualCaret(layer: HTMLElement): PlainExtension;
//#endregion
//#region src/extensions/wikilink-hover.d.ts
/** A wikilink currently under the pointer. */
interface WikilinkHoverHit extends WikilinkHit {
  /** The rendered wikilink label used as the popup anchor. */
  element: HTMLElement;
}
/** Called once on wikilink enter and with `undefined` on leave or invalidation. */
type WikilinkHoverHandler = (hit: WikilinkHoverHit | undefined) => void;
/**
 * Track the wikilink under the pointer without attaching per-link listeners.
 *
 * The handler is revalidated after document transactions and receives leave
 * when the hovered link is deleted, replaced, or changes target. Moving among
 * descendants of one label is de-duplicated.
 */
declare function defineWikilinkHoverHandler(onHoverChange: WikilinkHoverHandler): PlainExtension;
//#endregion
//#region src/extensions/wikilink-trigger.d.ts
/**
 * Binds `Mod-Shift-k` to open the wikilink menu, and `[` to wrap a selected
 * phrase into an open wikilink (`[[phrase`) with the menu searching it.
 */
declare function defineWikilinkTrigger(): PlainExtension;
//#endregion
//#region src/utils/composition.d.ts
declare function getIsComposing(): boolean;
//#endregion
//#region src/utils/display-text.d.ts
/**
 * The textblock as its live-preview marks display it: syntax runs are
 * omitted and each atom unit is replaced by its display text.
 */
declare function getTextblockDisplayText(textblock: ProseMirrorNode): string;
//#endregion
//#region src/utils/format-file-size.d.ts
/**
 * Format a byte count for display on a file pill: decimal units (1 KB =
 * 1000 B, matching macOS Finder), one decimal below 10, integers otherwise.
 */
declare function formatFileSize(bytes: number): string;
//#endregion
//#region src/utils/katex-chunk.d.ts
type KaTeXRender = typeof render;
//#endregion
//#region src/utils/katex.d.ts
/**
 * Load KaTeX's render function on first use and cache it. Most documents
 * contain no math, so the library stays out of the initial bundle.
 */
declare function loadKaTeX(): Promise<KaTeXRender>;
/**
 * Render TeX into `element` as native MathML (no KaTeX stylesheet or fonts
 * required). `throwOnError: false` renders parse errors as red text; the
 * catch covers the rare non-parse error so a bad formula can never crash a
 * render.
 */
declare function renderMathInto(katexRender: KaTeXRender, element: HTMLElement, formula: string, displayMode: boolean): void;
//#endregion
//#region src/utils/selected-text.d.ts
/**
 * The current selection as Markdown: block structure (list markers, headings,
 * blockquotes) is serialized, and inline Markdown syntax is already literal
 * text in the document. A selection inside one textblock comes back as its
 * bare text; a multi-block selection keeps its block markers, so downstream
 * consumers (e.g. an AI prompt) see the same Markdown the user would.
 */
declare function getSelectedText(state: EditorState): string;
//#endregion
//#region src/utils/virtual-element.d.ts
/**
 * Returns a Floating-UI virtual element tracking a document range.
 *
 * Positioning libraries re-measure asynchronously (resize observers, animation
 * frames), so a measurement can fire after the view is destroyed or the range
 * no longer resolves; those return the last known rect instead of throwing.
 */
declare function getVirtualElementFromRange(view: EditorView, range: PositionRange): VirtualElement;
//#endregion
export { type AcceptPendingReplacementOptions, type CheckRoundTripOptions, type CodeBlockAttrs, type CodeBlockFenceStyle, type CodeToken, type DocToMarkdownOptions, EDITOR_KEY_BINDINGS, type EditorExtension, type EditorExtensionOptions, type EmbedDescriptor, type ExitBoundaryHandler, type ExitBoundaryOptions, type FileClickHandler, type FileClickPayload, type FileInfo, type FileInfoResolver, type FileLinkOptions, type FileLinkPayload, type FileLinkResolver, type FilePasteHandler, type FilePasteOptions, type FileSaveErrorHandler, type FileViewOptions, type FollowLinkHandlers, type ImageClickHandler, type ImageClickPayload, type ImageOptions, type InlineMarkContext, type InlineMarkOptions, type KaTeXRender, type LanguageItem, type LinkAttrs, type LinkClickHandler, type LinkClickPayload, type LinkCopyHandler, type LinkCopyPayload, type LinkEditHandler, type LinkEditOptions, type LinkHoverHandler, type LinkUnit, type ListMarker, type MarkChunk, type MarkMode, type MarkName, type MarkdownToDocOptions, type MdFileAttrs, type MdImageAttrs, type MdLinkTextAttrs, type MdMathAttrs, type MdWikilinkAttrs, type MeowdownCodeBlockAttrs, type MeowdownHTMLCommentAttrs, type MeowdownListAttrs, type MeowdownTableCellAttrs, type NodeName, type ParsedWikiEmbed, type PendingReplacement, type PendingReplacementEvent, type PendingReplacementHandler, type PendingReplacementMode, type PendingReplacementOutcome, type PlaceholderOptions, type PositionRange, Priority, type ReferenceDefinition, type ReferenceDefinitionIndex, type ReferenceDefinitions, type RoundTripFidelity, type SearchStatus, type SearchStatusHandler, type StartPendingReplacementOptions, type TableColumnAlign, type TagClickHandler, type TagClickPayload, type TypedEditor, type TypedMarkBuilders, type VirtualElement, type WikiEmbedOptions, type WikiEmbedResolution, type WikiEmbedResolver, type WikilinkClickHandler, type WikilinkClickPayload, type WikilinkHoverHandler, type WikilinkHoverHit, buildFileMarkdown, checkRoundTrip, codeBlockLanguages, collectReferenceDefinitions, defaultResolveImageUrl, defineBulletAfterHeading, defineCodeBlockPreviewPlugin, defineCodeBlockSyntaxHighlight, defineEditorExtension, defineEmbedPaste, defineExitBoundaryHandler, defineFileClickHandler, defineFilePaste, defineFileView, defineFollowLinkHandler, defineHTMLComment, defineImage, defineImageClickHandler, defineLinkClickHandler, defineLinkCommands, defineLinkEditKeymap, defineLinkHoverHandler, defineLinkPaste, defineMath, definePendingReplacementHandler, definePlaceholder, defineReadonly, defineSearchStatusHandler, defineSpellCheckPlugin, defineSubstitution, defineTagClickHandler, defineViewAttributes, defineVirtualCaret, defineWikilinkClickHandler, defineWikilinkHoverHandler, defineWikilinkTrigger, docToMarkdown, formatFileSize, formatSizedWikiEmbed, getCodeTokens, getFileKind, getIsComposing, getLinkUnitAt, getMarkBuilders, getPendingReplacement, getSearchStatus, getSelectedText, getTableColumnAlign, getTextblockDisplayText, getVirtualElementFromRange, inlineTextToMarkChunks, inlineTextToMarkChunksWithContext, insertLink, isCodeBlockPreviewHiddenDecoration, isMarkOfType, isNodeOfType, isSelectionInTableCell, listenForTweetHeight, loadKaTeX, markdownToDoc, matchEmbed, parseWikiEmbed, removeLink, renderMathInto, updateLink, wikiEmbedBasename, withPriority };