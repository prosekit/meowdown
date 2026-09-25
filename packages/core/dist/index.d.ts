import { Editor, Extension, ExtractMarkBuilders, ExtractNodeBuilders, PlainExtension, Priority, Union, withPriority } from "@prosekit/core";
import { CodeBlockAttrs, CodeBlockAttrs as CodeBlockAttrs$1, defineCodeBlockPreviewPlugin, isCodeBlockPreviewHiddenDecoration } from "@prosekit/extensions/code-block";
import { PlaceholderOptions, PlaceholderOptions as PlaceholderOptions$1, definePlaceholder } from "@prosekit/extensions/placeholder";
import { Command, EditorState, PluginKey } from "@prosekit/pm/state";
import { SearchStatus, SearchStatusHandler, defineSearchStatusHandler, getSearchStatus } from "@prosekit/extensions/search";
import { EditorView } from "@prosekit/pm/view";
import { EditorNode, Mark, ProseMirrorNode } from "@prosekit/pm/model";
import { ListAttrs } from "@prosekit/extensions/list";
import { HorizontalRuleExtension } from "@prosekit/extensions/horizontal-rule";
import { Resolver, XPostMediaClickEvent } from "@meowdown/embed/x";
import { YouTubeVideoClickEvent } from "@meowdown/embed/youtube";
import { render } from "katex";
import { XPost, YouTubeVideo } from "@post-embed/types";
import { VirtualElement } from "@floating-ui/dom";
//#region src/extensions/readonly.d.ts
export declare function defineReadonly(getReadonly?: (state: EditorState) => boolean): PlainExtension;
//#endregion
//#region src/converters/check-roundtrip.d.ts
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
  frontmatter?: boolean;
}
/**
 * Classify how `markdown` survives the editor's parse-then-serialize round trip.
 */
export declare function checkRoundTrip(markdown: string, options?: CheckRoundTripOptions): RoundTripFidelity;
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
export declare function getTableColumnAlign(state: EditorState): TableColumnAlign | undefined;
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
export declare function defineHTMLComment(): HTMLCommentExtension;
//#endregion
//#region src/extensions/inline-marks.d.ts
/**
 * Attributes of the `mdImage` mark, derived from either `![alt](src "title")`
 * (plus an optional trailing size comment) or a resolved wiki image embed.
 */
interface MdImageAttrs {
  /**
   * The image destination, exactly as written in the source.
   */
  src: string;
  /**
   * The image alt text.
   */
  alt: string;
  /**
   * The image title, or `''` when the source has none.
   */
  title: string;
  /**
   * Display width in CSS pixels from the trailing comment, or `null`.
   */
  width: number | null;
  /**
   * Display height in CSS pixels from the trailing comment, or `null`.
   */
  height: number | null;
  /**
   * The saved post-embed snapshot from the trailing comment, or `null`.
   */
  snapshot: object | null;
  /**
   * `wikiEmbed` when the source is `![[target]]`; otherwise `null`.
   */
  syntax: 'wikiEmbed' | null;
  /**
   * Original wiki-embed target used when persisting a resized image, or `null`.
   */
  wikiTarget: string | null;
}
interface MdLinkTextAttrs {
  href: string;
}
interface MdWikilinkAttrs {
  /**
   * Target passed to click and hover handlers: the bracketed text unless the
   * host's `resolveWikilink` replaced it.
   */
  target: string;
  /**
   * Label shown in place of the source, or `''` to show the target.
   */
  display: string;
}
/**
 * Attributes of the `mdFile` mark: a whole `[label](url)` link that the host's
 * `resolveFileLink` claimed as a file attachment, rendered as a file pill.
 */
interface MdFileAttrs {
  /**
   * The link destination, exactly as written in the source.
   */
  href: string;
  /**
   * The display name: the raw label slice, or the `href` basename when the label is empty.
   */
  name: string;
  /**
   * The link title, or `''` when the source has none.
   */
  title: string;
}
/**
 * Attributes of the `mdMath` mark: a whole `$formula$` / `$$formula$$` inline
 * math expression, rendered by `MathMarkView`.
 */
interface MdMathAttrs {
  /**
   * The TeX source between the dollar delimiters.
   */
  formula: string;
}
/**
 * Content-derived identity of one inline syntax unit.
 *
 * - `key`: the unit's kind. It keeps adjacent same-kind units apart and stays
 *   stable when unrelated text in the block is edited, so editing one unit
 *   never re-marks the others.
 * - `data`: the unit's parsed data, read off the mark instead of
 *   re-parsing the text.
 * - `slot`: `1` when the pack would otherwise equal the pack of the unit
 *   ending exactly where this one starts; equal packs would merge the two
 *   units into one mark run and one mark view.
 * - `revealInFocus`/`revealInHide`: the mark modes in which the unit's
 *   source reveals around the caret.
 */
type MdPackAttrs = {
  key: 'italic' | 'bold' | 'code' | 'del' | 'highlight';
  data?: null;
  slot?: 1 | null;
  revealInFocus: true;
  revealInHide?: null;
} | {
  key: 'link-inline' | 'link-reference';
  data: {
    href: string;
    title: string;
  };
  slot?: 1 | null;
  revealInFocus: true;
  revealInHide?: null;
} | {
  key: 'link-angle';
  data: {
    href: string;
  };
  slot?: 1 | null;
  revealInFocus: true;
  revealInHide?: null;
} | {
  key: 'link-bare';
  data: {
    href: string;
  };
  slot?: 1 | null;
  revealInFocus?: null;
  revealInHide?: null;
} | {
  key: 'noLink';
  data?: null;
  slot?: 1 | null;
  revealInFocus: true;
  revealInHide?: null;
} | {
  key: 'math';
  data?: null;
  slot?: 1 | null;
  revealInFocus: true;
  revealInHide: true;
} | {
  key: 'wikilink' | 'image' | 'file';
  data?: null;
  slot?: 1 | null;
  revealInFocus?: null;
  revealInHide?: null;
};
//#endregion
//#region src/utils/range.d.ts
interface PositionRange {
  from: number;
  to: number;
}
//#endregion
//#region src/extensions/get-link-unit-at.d.ts
interface LinkUnitBase {
  state: EditorState;
  /**
   * Whole inline link, reference link, or autolink range.
   */
  unit: PositionRange;
  /**
   * The visible text of the link: the `[ ]` interior for a full link, the URL
   * between `< >` for an angle autolink, the whole unit for a bare autolink.
   * Popovers anchor on it; the unit's edges can sit inside hidden syntax,
   * whose collapsed glyphs measure at bogus coordinates.
   */
  text: PositionRange;
  /**
   * The link URL. Could be an empty string.
   */
  href: string;
  /**
   * The link title, unquoted. Could be an empty string.
   */
  title: string;
}
type LinkUnit = (LinkUnitBase & {
  form: 'inline';
  /**
   * Interior of `[ ]`.
   */
  label: PositionRange;
  /**
   * Interior of `( )`. What `updateLink` rewrites.
   */
  dest: PositionRange;
}) | (LinkUnitBase & {
  /**
   * A reference link or autolink resolves an href but has no editable
   * label/dest.
   */
  form: 'reference' | 'angle' | 'bare';
  label?: undefined;
  dest?: undefined;
});
/**
 * The link covering `pos`, with its sub-ranges (`label`, `dest`) and parsed
 * `href`/`title`. The single query the commands and the hover/click handlers
 * share, replacing the old `findLinkAt`.
 *
 * Derived entirely from the marks already on the document (no re-parse): the
 * `mdPack` unit gives the shape and carries the `href`/`title` in its `data`, and
 * the `mdLinkUri` run locates the `( )` body.
 */
export declare function getLinkUnitAt(state: EditorState, pos: number): LinkUnit | undefined;
//#endregion
//#region src/extensions/link-commands.d.ts
interface LinkAttrs {
  href?: string;
  title?: string;
  text?: string;
}
/**
 * Normalize a typed URL with the existing autolink logic, else keep it verbatim.
 */
export declare function normalizeHref(raw: string): string;
/**
 * Get a link's plain visible text.
 */
export declare function getLinkText(link: LinkUnit): string;
/**
 * Whether plain visible link text names the same destination as the link.
 */
export declare function isLinkTextForHref(text: string, href: string): boolean;
interface InsertLinkOptions {
  href?: string;
  title?: string;
  text?: string;
  wrapText?: boolean;
}
export declare function insertLink({ href, title, text, wrapText }?: InsertLinkOptions): Command;
/**
 * Rewrite a mutable link. Autolinks are promoted to inline Markdown when
 * their visible text or destination changes.
 */
export declare function updateLink(attrs: LinkAttrs): Command;
/**
 * Unwrap the link at the caret: keep the label text, drop the syntax.
 */
export declare function removeLink(): Command;
export declare function defineLinkCommands(): Extension<{
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
  text: string;
}
type LinkEditHandler = (options: LinkEditOptions) => void;
export declare function defineLinkEditKeymap(onLinkEdit: LinkEditHandler): PlainExtension;
//#endregion
//#region src/extensions/pending-replacement.d.ts
/**
 * Where an accepted replacement lands relative to the source range.
 */
type PendingReplacementMode = 'replace' | 'append';
/**
 * How a pending replacement ended.
 */
type PendingReplacementOutcome = 'accepted' | 'discarded';
/**
 * A staged replacement: Markdown text accumulating over `[from, to]` that is
 * only written into the document when accepted. Until then the document is
 * untouched; discarding is a no-op.
 */
interface PendingReplacement {
  /**
   * Start of the source range the replacement targets.
   */
  from: number;
  /**
   * End of the source range the replacement targets.
   */
  to: number;
  /**
   * The Markdown accumulated so far (e.g. streamed from an AI provider).
   */
  text: string;
  /**
   * Whether accepting replaces the source range or inserts after its block.
   */
  mode: PendingReplacementMode;
}
/**
 * The active pending replacement, or null when there is none.
 */
export declare function getPendingReplacement(state: EditorState): PendingReplacement | null;
/**
 * Options for the `startPendingReplacement` command.
 */
interface StartPendingReplacementOptions extends PositionRange {
  mode: PendingReplacementMode;
}
/**
 * Options for the `acceptPendingReplacement` command.
 */
interface AcceptPendingReplacementOptions {
  /**
   * Overrides the staged mode for this accept (e.g. "Insert below" on a replace stage).
   */
  mode?: PendingReplacementMode;
}
/**
 * A pending-replacement change: text/range updates, or how the stage ended.
 */
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
export declare function definePendingReplacementHandler(handler: PendingReplacementHandler): PlainExtension;
//#endregion
//#region src/extensions/exit-boundary.d.ts
/**
 * Payload for {@link ExitBoundaryHandler}.
 */
interface ExitBoundaryOptions {
  /**
   * The boundary the caret would leave: `up` at the document start, `down` at the end.
   */
  direction: 'up' | 'down';
  /**
   * The originating arrow key press.
   */
  event: KeyboardEvent;
}
/**
 * Called when an arrow key press would move the caret past the document
 * boundary. Return `false` to let the editor handle the key normally; any
 * other return value consumes it.
 */
type ExitBoundaryHandler = (options: ExitBoundaryOptions) => boolean | void;
/**
 * Call `onExitBoundary` when an arrow key press would leave the document boundary.
 */
export declare function defineExitBoundaryHandler(getExitBoundaryHandler?: (state: EditorState) => ExitBoundaryHandler | undefined): PlainExtension;
//#endregion
//#region src/extensions/file-paste.d.ts
type FilePasteHandler = (file: File) => string | undefined | Promise<string | undefined>;
type FileSaveErrorHandler = (error: unknown, file: File) => void;
/**
 * Options for {@link defineFilePaste}.
 */
interface FilePasteOptions {
  /**
   * Persist a pasted/dropped file and return its markdown destination, or
   * `undefined` to decline (nothing is inserted, but the event is consumed).
   * An image (`image/*` MIME type or a recognized image filename extension)
   * inserts `![](src)`; any other file inserts a `[name](src)` link.
   */
  onFilePaste?: FilePasteHandler;
  /**
   * Called when persisting a pasted/dropped file throws. Defaults to `console.error`.
   */
  onFileSaveError?: FileSaveErrorHandler;
}
/**
 * The markdown a saved file becomes: `![](destination)` for an image (a
 * `type` starting with `image/` or a recognized image filename extension), a
 * `[name](destination)` link otherwise, with `\`, `[`, and `]` escaped in the
 * name. Exported so a host command that inserts file links itself (e.g. an
 * attach-file picker) produces markdown byte-identical to a paste/drop.
 */
export declare function buildFileMarkdown(file: {
  name: string;
  type?: string;
}, destination: string): string;
/**
 * Persist pasted/dropped files via `onFilePaste` and insert the returned
 * markdown destination: `![](src)` for an image, a `[name](src)` link for any
 * other file. Multiple files insert one link per line, in DataTransfer order.
 */
export declare function defineFilePaste(getOptions?: (state: EditorState) => FilePasteOptions | undefined): PlainExtension;
//#endregion
//#region src/extensions/file-view.d.ts
/**
 * Metadata a host resolves for one file link, shown on its pill.
 */
interface FileInfo {
  /**
   * File size in bytes, shown as a human-readable suffix (e.g. `1.4 MB`).
   */
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
/**
 * Options for {@link defineFileView}.
 */
interface FileViewOptions {
  /**
   * Resolve the metadata (file size) shown on a pill. Omit to show none.
   */
  resolveFileInfo?: FileInfoResolver;
}
/**
 * Classify a file destination for the pill's `data-file-kind` attribute.
 */
export declare function getFileKind(href: string): string;
/**
 * Render a claimed file link or wiki embed (the `mdFile` mark) as an inline
 * pill: a file-kind icon, the file name, and the size once
 * `resolveFileInfo` supplies it. The pill never loads the file's content;
 * clicks are reported through `defineFileClickHandler`.
 */
export declare function defineFileView(getOptions?: (state: EditorState) => FileViewOptions): PlainExtension;
//#endregion
//#region src/extensions/file-click.d.ts
/**
 * Payload for {@link FileClickHandler}.
 */
interface FileClickPayload {
  /**
   * The resolved destination from `[name](href)` or a claimed `![[target]]`.
   */
  href: string;
  /**
   * The file name shown on the pill.
   */
  name: string;
  /**
   * The originating click, or the `Enter`/`Mod-Enter` key press that followed the
   * pill. Read modifier keys or position a popover from it.
   */
  event: MouseEvent | KeyboardEvent;
  /**
   * Whether the platform's mod key (`Command` on Apple, `Ctrl` elsewhere) was held
   * beyond the gesture that triggered the activation.
   */
  mod: boolean;
}
type FileClickHandler = (payload: FileClickPayload) => void;
/**
 * Call `onClick` when the user clicks a rendered file pill, with the file's
 * `href`, `name`, and the originating `MouseEvent`. The host decides what a
 * click does (e.g. open the file in the OS default app).
 */
export declare function defineFileClickHandler(getOnClick?: (state: EditorState) => FileClickHandler | undefined): PlainExtension;
//#endregion
//#region src/extensions/image-click.d.ts
/**
 * Payload for {@link ImageClickHandler}.
 */
interface ImageClickPayload {
  /**
   * The resolved source from `![alt](src)` or a claimed `![[target]]`.
   */
  src: string;
  /**
   * The image alt text.
   */
  alt: string;
  /**
   * The originating click or touch tap, or the `Enter`/`Mod-Enter` key press
   * that followed the selected image. Read the target or position a popover
   * from it; a touch surface delivers the `touchend` instead of a click.
   */
  event: MouseEvent | TouchEvent | KeyboardEvent;
  /**
   * The rendered `<img>` of a click or tap, for example to zoom a lightbox
   * from. A key press has none.
   */
  element?: HTMLImageElement | undefined;
  /**
   * Whether the platform's mod key (`Command` on Apple, `Ctrl` elsewhere) was held
   * beyond the gesture that triggered the activation.
   */
  mod: boolean;
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
export declare function defineImageClickHandler(getOnClick?: (state: EditorState) => ImageClickHandler | undefined): PlainExtension;
//#endregion
//#region src/extensions/link-click.d.ts
interface LinkClickPayload {
  href: string;
  /**
   * The originating click, or the `Enter`/`Mod-Enter` key press that followed the link.
   */
  event: MouseEvent | KeyboardEvent;
  /**
   * Whether the platform's mod key (`Command` on Apple, `Ctrl` elsewhere) was held
   * beyond the gesture that triggered the activation.
   */
  mod: boolean;
}
type LinkClickHandler = (payload: LinkClickPayload) => void;
interface LinkCopyPayload {
  href: string;
}
type LinkCopyHandler = (payload: LinkCopyPayload) => void;
/**
 * Call `onClick` when the user clicks a rendered Markdown link
 * (`[text](url)`), or presses `Mod-Enter` with the caret on one. The `event`
 * is the originating `MouseEvent` or `KeyboardEvent`.
 */
export declare function defineLinkClickHandler(getOnClick?: (state: EditorState) => LinkClickHandler | undefined): PlainExtension;
//#endregion
//#region src/extensions/tag-click.d.ts
interface TagClickPayload {
  /**
   * The tag name, without the leading `#`.
   */
  tag: string;
  /**
   * The originating click, or the `Enter`/`Mod-Enter` key press that followed the tag.
   * Read modifier keys or position a popover from it.
   */
  event: MouseEvent | KeyboardEvent;
  /**
   * Whether the platform's mod key (`Command` on Apple, `Ctrl` elsewhere) was held
   * beyond the gesture that triggered the activation.
   */
  mod: boolean;
}
type TagClickHandler = (payload: TagClickPayload) => void;
/**
 * Call `onClick` when the user clicks a rendered `#tag`, or presses
 * `Mod-Enter` with the caret on one. The `tag` is read from the rendered text
 * without the leading `#`.
 */
export declare function defineTagClickHandler(getOnClick?: (state: EditorState) => TagClickHandler | undefined): PlainExtension;
//#endregion
//#region src/extensions/wikilink-click.d.ts
interface WikilinkHit {
  from: number;
  to: number;
  target: string;
}
interface WikilinkClickPayload {
  target: string;
  /**
   * The originating click, or the `Enter`/`Mod-Enter` key press that followed the link.
   */
  event: MouseEvent | KeyboardEvent;
  /**
   * Whether the platform's mod key (`Command` on Apple, `Ctrl` elsewhere) was held
   * beyond the gesture that triggered the activation.
   */
  mod: boolean;
}
type WikilinkClickHandler = (payload: WikilinkClickPayload) => void;
/**
 * Call `onClick` when the user clicks a rendered wikilink label, or presses
 * `Mod-Enter` with the caret on one. The `event` is the originating
 * `MouseEvent` or `KeyboardEvent`.
 */
export declare function defineWikilinkClickHandler(getOnClick?: (state: EditorState) => WikilinkClickHandler | undefined): PlainExtension;
//#endregion
//#region src/extensions/follow-link.d.ts
interface FollowLinkHandlers {
  onWikilinkClick?: WikilinkClickHandler;
  onTagClick?: TagClickHandler;
  onFileClick?: FileClickHandler;
  onLinkClick?: LinkClickHandler;
  onImageClick?: ImageClickHandler;
}
/**
 * Binds `Mod-Enter` to follow the wikilink, tag, file pill, or Markdown link
 * under the caret, and plain `Enter` to follow a selected atom unit (a
 * wikilink, file pill, or image), firing the same handlers a click does.
 * "Under the caret" means strictly inside the unit: a caret merely touching
 * a unit's edge is next to it, not on it.
 * Off a link, `Mod-Enter` falls through so the list keymap keeps cycling
 * checkbox tasks; off a selected unit, `Enter` falls through to the regular
 * split. High priority puts this ahead of every keymap binding.
 *
 * A selected-unit follow reports `mod: true` when the platform's mod key
 * (`⌘` on Apple, `Ctrl` elsewhere) was held beyond its plain-`Enter` trigger;
 * a caret follow always reports `mod: false`, its mod key being the trigger
 * itself.
 */
export declare function defineFollowLinkHandler(getHandlers?: (state: EditorState) => FollowLinkHandlers): PlainExtension;
//#endregion
//#region src/extensions/post-embed.d.ts
type XPostResolver = Resolver<XPost>;
type YouTubeVideoResolver = Resolver<YouTubeVideo>;
export declare const defaultResolveXPost: XPostResolver;
export declare const defaultResolveYouTubeVideo: YouTubeVideoResolver;
/**
 * The `snapshot` field of an image's magic comment: the card kind and the
 * data post-embed renders. The kind is stored explicitly, so a saved snapshot
 * is validated once, against the schema it names.
 */
type PostEmbedSnapshot = {
  kind: 'x-post';
  data: XPost;
} | {
  kind: 'youtube-video';
  data: YouTubeVideo;
};
/**
 * The snapshot a card renders from a saved JSON object, or `undefined` when
 * the object does not validate. Unknown fields are dropped, so a persisted
 * snapshot is exactly what the card needs.
 */
export declare function parsePostEmbedSnapshot(value: unknown): PostEmbedSnapshot | undefined;
//#endregion
//#region src/extensions/image.d.ts
type ImageUrlResolver = (src: string) => string | undefined;
/**
 * Options for {@link defineImage}.
 */
interface ImageOptions {
  /**
   * Map a markdown `src` to a displayable URL, or `undefined` to skip rendering
   * that image. Defaults to `defaultResolveImageUrl`.
   */
  resolveImageUrl?: ImageUrlResolver;
  /**
   * Resolve the data behind an X post URL.
   * When omitted, public posts use `defaultResolveXPost`.
   */
  resolveXPost?: XPostResolver;
  /**
   * Additional trusted protocols for X media URLs, such as `reflect-asset:`.
   */
  mediaUrlProtocols?: string[];
  /**
   * Resolve the data behind a YouTube video URL, rendered as a
   * `meowdown-embed-youtube` card. Defaults to `defaultResolveYouTubeVideo`,
   * which reads YouTube's oEmbed endpoint.
   */
  resolveYouTubeVideo?: YouTubeVideoResolver;
}
/**
 * Show an `src` as-is when it is an http(s) URL, otherwise skip rendering it.
 */
export declare function defaultResolveImageUrl(src: string): string | undefined;
/**
 * Inline image/embed rendering: a mark view on the `mdImage` mark. Images
 * render in place from their literal Markdown source. Drag a rendered image's
 * corner handle to write the size back into the source as a trailing comment,
 * `![alt](src)<!-- {"width":320,"height":240} -->`, which round-trips as
 * plain Markdown.
 */
export declare function defineImage(getOptions?: (state: EditorState) => ImageOptions | undefined): PlainExtension;
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
export declare function isReferenceDefinitionNode(node: EditorNode, parent: EditorNode | null, index: number): boolean;
export declare function collectReferenceDefinitions(doc: EditorNode): ReferenceDefinitionIndex;
//#endregion
//#region src/extensions/wiki-embed.d.ts
/**
 * The parsed source payload of an Obsidian-style `![[target]]` embed.
 */
interface ParsedWikiEmbed {
  /**
   * Target before an optional alias or size suffix.
   */
  target: string;
  /**
   * Non-size suffix after `|`, or `''` when absent.
   */
  display: string;
  /**
   * Requested display width in CSS pixels, or `null`.
   */
  width: number | null;
  /**
   * Requested display height in CSS pixels, or `null`.
   */
  height: number | null;
}
/**
 * A resolved wiki embed rendered through Meowdown's existing atom views.
 */
type WikiEmbedResolution = {
  kind: 'image';
  /**
   * Source passed to `resolveImageUrl` and image click handlers. Defaults to `target`.
   */
  src?: string;
  /**
   * Image alt text. Defaults to the alias or target basename.
   */
  alt?: string;
} | {
  kind: 'file';
  /**
   * Destination passed to file metadata and click handlers. Defaults to `target`.
   */
  href?: string;
  /**
   * File pill label. Defaults to the alias or target basename.
   */
  name?: string;
  /**
   * Optional file title.
   */
  title?: string;
} | {
  kind: 'note';
  /**
   * Target passed to wikilink click handlers. Defaults to the source target.
   */
  target?: string;
  /**
   * Chip label. Defaults to the source alias or resolved target.
   */
  display?: string;
};
/**
 * Classifies one wiki embed for rendering. Return `undefined` to leave the
 * source literal and editable. The resolver participates in the parse cache,
 * so it must be pure: the same payload must always return the same result.
 */
type WikiEmbedResolver = (embed: ParsedWikiEmbed) => WikiEmbedResolution | undefined;
/**
 * Host options for wiki-embed parsing.
 */
interface WikiEmbedOptions {
  resolveWikiEmbed?: WikiEmbedResolver;
}
/**
 * Parse `![[target]]`, `![[target|alias]]`, `![[target|width]]`, or `![[target|widthxheight]]`.
 */
export declare function parseWikiEmbed(source: string): ParsedWikiEmbed;
/**
 * Rewrite a wiki image embed with a persisted display size.
 */
export declare function formatSizedWikiEmbed(target: string, width: number, height: number): string;
/**
 * Last path component of a target, with a note heading/block fragment removed.
 */
export declare function wikiEmbedBasename(target: string): string;
//#endregion
//#region src/extensions/wikilink.d.ts
/**
 * What {@link WikilinkResolver} sees for one `[[...]]` wikilink.
 */
interface WikilinkPayload {
  /**
   * The text between the brackets, trimmed. Meowdown reads no syntax inside
   * it: an alias form such as `[[target|alias]]` arrives here whole.
   */
  target: string;
}
/**
 * A resolved wikilink.
 */
interface WikilinkResolution {
  /**
   * Target passed to click and hover handlers. Defaults to the bracketed text.
   */
  target?: string;
  /**
   * Label shown in place of the source. Defaults to the target.
   */
  display?: string;
}
/**
 * Resolves one `[[...]]` wikilink into the target its handlers receive and
 * the label its chip shows; the Markdown source stays as written. Return
 * `undefined` to use the bracketed text as both. The resolver participates
 * in the parse cache, so it must be pure: the same payload must always
 * return the same result.
 */
type WikilinkResolver = (link: WikilinkPayload) => WikilinkResolution | undefined;
/**
 * Host options for wikilink parsing.
 */
interface WikilinkOptions {
  resolveWikilink?: WikilinkResolver;
}
//#endregion
//#region src/extensions/inline-text-to-mark-chunks.d.ts
/**
 * What {@link FileLinkResolver} sees for one `[label](url)` link.
 */
interface FileLinkPayload {
  /**
   * The link destination, exactly as written in the source.
   */
  href: string;
  /**
   * The raw label slice between the brackets; may be empty or contain nested syntax.
   */
  label: string;
  /**
   * The link title, or `''` when the source has none.
   */
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
/**
 * Host options that influence inline parsing.
 */
interface FileLinkOptions {
  /**
   * Claim `[label](url)` links as file attachments; see {@link FileLinkResolver}.
   * Updates existing content when the configured resolver changes.
   */
  resolveFileLink?: FileLinkResolver;
}
/**
 * Host options that influence source-backed inline atom parsing.
 */
type InlineMarkOptions = FileLinkOptions & WikiEmbedOptions & WikilinkOptions;
interface InlineMarkContext {
  /**
   * Effective document-wide definitions, keyed by normalized reference label.
   */
  referenceDefinitions?: ReferenceDefinitions;
  /**
   * Prevent this definition block's own label from resolving as a shortcut reference.
   */
  isReferenceDefinition?: boolean;
  /**
   * Receives every normalized key read by this block, including unresolved references.
   */
  referencedKeys?: Set<string>;
}
/**
 * Walk a textblock's inline content and produce a list of mark chunks
 * with positions relative to the start of `text` (i.e. zero-based).
 * Callers shift the chunks into the document's coordinate space.
 */
export declare function inlineTextToMarkChunks(
/**
 * Typed mark builders bound to the target schema.
 */
marks: TypedMarkBuilders,
/**
 * The raw inline text of one textblock (no block prefix).
 */
text: string,
/**
 * Host options; omit for the default parse.
 */
options?: InlineMarkOptions): MarkChunk[];
export declare function inlineTextToMarkChunksWithContext(marks: TypedMarkBuilders, text: string, options?: InlineMarkOptions, context?: InlineMarkContext): MarkChunk[];
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
//#region src/extensions/x-post-media-click.d.ts
/**
 * Receives the `meowdown-embed-media-click` event of an X post card. Its
 * `detail` holds the activated photo or video, its sibling items, and the
 * rendered thumbnail element. Call `event.preventDefault()` to cancel the
 * card's own default (open the photo URL, play the video in place).
 */
type XPostMediaClickHandler = (event: XPostMediaClickEvent) => void;
/**
 * Call `onClick` when the user activates a photo or video inside an X post
 * card.
 */
export declare function defineXPostMediaClickHandler(getOnClick?: (state: EditorState) => XPostMediaClickHandler | undefined): PlainExtension;
//#endregion
//#region src/extensions/youtube-video-click.d.ts
/**
 * Receives the `meowdown-embed-youtube-click` event of a YouTube card. Its
 * `detail` holds the video, the player URL, and the rendered thumbnail
 * element. Call `event.preventDefault()` to cancel the card's own default
 * (play the video in place).
 */
type YouTubeVideoClickHandler = (event: YouTubeVideoClickEvent) => void;
/**
 * Call `onClick` when the user activates the poster of a YouTube card.
 */
export declare function defineYouTubeVideoClickHandler(getOnClick?: (state: EditorState) => YouTubeVideoClickHandler | undefined): PlainExtension;
//#endregion
//#region src/extensions/editor-config-types.d.ts
interface EditorConfig extends InlineMarkOptions, FollowLinkHandlers, FilePasteOptions, FileViewOptions, ImageOptions {
  markMode?: MarkMode;
  onExitBoundary?: ExitBoundaryHandler;
  onXPostMediaClick?: XPostMediaClickHandler;
  onYouTubeVideoClick?: YouTubeVideoClickHandler;
  embedPaste?: boolean;
  linkPaste?: boolean;
  bulletAfterHeading?: boolean;
  substitution?: boolean;
  wikilinkEnabled?: boolean;
  placeholder?: PlaceholderOptions$1['placeholder'];
  readOnly?: boolean;
  spellCheck?: boolean;
  editorClassName?: string;
}
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
}>, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension]>, MeowdownHorizontalRuleExtension, import("@prosekit/core").Extension<{
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
}>]>, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").Extension<import("@prosekit/core").ExtensionTyping<any, any, any>>, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").Union<readonly [import("@prosekit/core").Extension<{
  Commands: {
    insertSoftBreak: [];
  };
}>, import("@prosekit/core").PlainExtension]>, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").Union<readonly [import("@prosekit/core").Extension<{
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
}>, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").BaseCommandsExtension, import("@prosekit/core").HistoryExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").PlainExtension, import("@prosekit/core").Extension<{
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
 * Initial configuration, updatable with `updateEditorConfig`.
 */
type EditorExtensionOptions = EditorConfig;
export declare function defineEditorExtension(options?: EditorExtensionOptions): EditorExtension;
type TypedEditor = Editor<EditorExtension>;
//#endregion
//#region src/extensions/schema.d.ts
type TypedNodeBuilders = ExtractNodeBuilders<EditorExtension>;
type TypedMarkBuilders = ExtractMarkBuilders<EditorExtension>;
/**
 * Typed mark builders bound to the shared schema.
 */
export declare const getMarkBuilders: () => TypedMarkBuilders;
//#endregion
//#region src/converters/md-to-pm.d.ts
/**
 * Options for {@link markdownToDoc}.
 */
interface MarkdownToDocOptions {
  /**
   * Node builders to build the document with. Defaults to the shared schema's builders.
   */
  nodes?: TypedNodeBuilders;
  /**
   * Whether to peel a leading `---` frontmatter block onto the doc's `frontmatter` attribute. Off by default.
   */
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
export declare function markdownToDoc(markdown: string, options?: MarkdownToDocOptions): ProseMirrorNode;
//#endregion
//#region src/converters/pm-to-md.d.ts
/**
 * Options for {@link docToMarkdown}.
 */
interface DocToMarkdownOptions {
  /**
   * Whether to serialize the doc's `frontmatter` attribute as a leading `---` block. Off by default.
   */
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
export declare function docToMarkdown(node: ProseMirrorNode, options?: DocToMarkdownOptions): string;
//#endregion
//#region src/extensions/bullet-after-heading.d.ts
/**
 * "Type a title, press Return, start bullets." When this extension is applied,
 * pressing Enter at the end of the document's first heading (the title line)
 * drops the caret into a fresh empty bullet instead of a plain paragraph.
 */
export declare function defineBulletAfterHeading(enabled?: (state: EditorState) => boolean): PlainExtension;
//#endregion
//#region src/extensions/code-block-highlight.d.ts
/**
 * Adds syntax highlighting to `codeBlock` nodes, parsing each block with the
 * matching CodeMirror/Lezer grammar (loaded on demand from
 * `@codemirror/language-data`). Tokens are tagged with `@lezer/highlight`
 * `tok-*` classes; the default theme colors them per color scheme.
 */
export declare function defineCodeBlockSyntaxHighlight(): Extension;
/**
 * A highlighted span of code: `[from, to)` carries the `@lezer/highlight` classes.
 */
type CodeToken = readonly [from: number, to: number, classes: string];
/**
 * Highlight `code` in `language` into `tok-*` token spans, the same classes the
 * editor's decorations use. Returns synchronously when the grammar is already
 * loaded (the common path, no render flash), and a `Promise` only when a grammar
 * must load on demand. Returns `[]` for an empty or unsupported language.
 */
export declare function getCodeTokens(code: string, language: string): CodeToken[] | Promise<CodeToken[]>;
//#endregion
//#region src/extensions/code-block-languages.d.ts
type LanguageItem = {
  label: string;
  value: string;
};
/**
 * A list of languages for code block syntax-highlight.
 */
export declare const codeBlockLanguages: ReadonlyArray<LanguageItem>;
//#endregion
//#region src/extensions/editor-config-getter.d.ts
/**
 * Read the current configuration. Callback values are live, not historical state snapshots.
 */
export declare function getEditorConfig(state: EditorState): Readonly<EditorConfig>;
//#endregion
//#region src/extensions/editor-config.d.ts
export declare function updateEditorConfig(editor: Pick<Editor, 'state' | 'view' | 'mounted' | 'updateState'>, patch: Partial<EditorConfig>): void;
//#endregion
//#region src/extensions/embed-paste.d.ts
/**
 * Auto-embed a pasted tweet or YouTube link. When the clipboard holds exactly
 * one such URL, the link is rewritten to `![](url)`, which the image pipeline
 * renders as a rich embed. Enable it through the `embedPaste` configuration
 * or install this standalone extension.
 */
export declare function defineEmbedPaste(enabled?: (state: EditorState) => boolean): PlainExtension;
//#endregion
//#region src/extensions/key-bindings.d.ts
/**
 * Human-readable descriptions of the editor's formatting and heading shortcuts.
 */
export declare const EDITOR_KEY_BINDINGS: {
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
  readonly 'Shift-Enter': "Insert a line break, or leave a code block from its end";
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
interface LinkHoverOptions {
  /**
   * Return `false` while the pointer is on the popup the link opened: a
   * pending leave then re-checks later instead of firing.
   */
  canLeave?: () => boolean;
}
/**
 * Track the link under the user's attention: a mouse hover after a short
 * delay, or a touch tap immediately, since touch has no hover. Without the
 * tap entry, the popup's preview and actions would stay unreachable on
 * phones, where a tap on a link only places the caret and raises the
 * software keyboard.
 */
export declare function defineLinkHoverHandler(onHoverChange: LinkHoverHandler, { canLeave }?: LinkHoverOptions): PlainExtension;
/**
 * Tell the link hover handler that the user dismissed the UI it opened. The
 * link under the pointer stays silent until the pointer leaves it, so a
 * pending hover cannot reopen the UI.
 */
export declare function dismissLinkHover(state: EditorState): void;
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
 * embed. Enable it through the `linkPaste` configuration or install this
 * standalone extension.
 */
export declare function defineLinkPaste(enabled?: (state: EditorState) => boolean): PlainExtension;
//#endregion
//#region src/extensions/link-preview.d.ts
/**
 * Metadata a host application can supply for a web link.
 */
interface LinkPreview {
  readonly title: string;
  readonly description?: string;
  readonly iconSrc?: string;
}
/**
 * Resolve display metadata for a link, or return `undefined` when unavailable.
 * Deliberately signal-free to keep the API simple: callers drop stale results
 * instead of cancelling in-flight work.
 */
type LinkPreviewResolver = (href: string) => LinkPreview | undefined | Promise<LinkPreview | undefined>;
//#endregion
//#region src/extensions/mark-names.d.ts
declare const MARK_NAMES: readonly ["mdWikilink", "mdImage", "mdFile", "mdMath", "mdMark", "mdEm", "mdStrong", "mdCode", "mdLinkText", "mdLinkUri", "mdLinkTitle", "mdDel", "mdHighlight", "mdTag", "mdPack"];
type MarkName = (typeof MARK_NAMES)[number];
export declare function isMarkOfType(mark: Mark, name: MarkName): boolean;
//#endregion
//#region src/extensions/math.d.ts
/**
 * Inline math rendering: a KaTeX preview on the `mdMath` mark.
 */
export declare function defineMath(): PlainExtension;
//#endregion
//#region src/extensions/node-names.d.ts
/**
 * Every ProseMirror node name the editor schema knows about.
 */
declare const NODE_NAMES: readonly ["doc", "text", "paragraph", "heading", "blockquote", "list", "codeBlock", "horizontalRule", "htmlComment", "table", "tableRow", "tableCell", "tableHeaderCell"];
type NodeName = (typeof NODE_NAMES)[number];
export declare function isNodeOfType(node: ProseMirrorNode, name: NodeName): boolean;
//#endregion
//#region src/extensions/substitution.d.ts
/**
 * Apply the editor's automatic plain-text substitutions.
 */
export declare function defineSubstitution(enabled?: (state: EditorState) => boolean): PlainExtension;
//#endregion
//#region src/extensions/table.d.ts
/**
 * Whether the selection sits inside a table cell (data or header). Useful for
 * gating block-creating UI, since cells hold inline content only.
 */
export declare function isSelectionInTableCell(state: EditorState): boolean;
//#endregion
//#region src/extensions/view-attributes.d.ts
/**
 * Add DOM attributes to the editable root. `class` and `style` values from
 * every such extension are combined, so applying this more than once adds
 * classes instead of replacing them.
 */
export declare function defineViewAttributes(attributes: {
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
 * On a touch screen, while the last input was a finger or pen
 * ({@link getIsTouchInput}), the roles flip: the native caret stays visible
 * (it carries the system touch affordances: the drag magnifier, the caret-drag
 * long-press mode) and the virtual caret draws only at positions where the
 * native caret has no geometry, such as beside hidden Markdown syntax.
 *
 * `layer` is the element the caret draws into. The host owns its placement:
 * it must live outside the contenteditable and scroll together with the
 * content.
 */
export declare function defineVirtualCaret(layer: HTMLElement): PlainExtension;
//#endregion
//#region src/extensions/wikilink-hover.d.ts
/**
 * A wikilink currently under the pointer.
 */
interface WikilinkHoverHit extends WikilinkHit {
  /**
   * The rendered wikilink label used as the popup anchor.
   */
  element: HTMLElement;
}
/**
 * Called once on wikilink enter and with `undefined` on leave or invalidation.
 */
type WikilinkHoverHandler = (hit: WikilinkHoverHit | undefined) => void;
/**
 * Track the wikilink the pointer rests on without attaching per-link
 * listeners.
 *
 * A cold pointer must rest on a link for `openDelay` ms before enter fires.
 * Moving to an adjacent link restarts the delay, or switches at once when a
 * link is already entered. Leave fires `closeDelay` ms after the pointer
 * leaves, and immediately when the hovered link is deleted, replaced, or
 * changes target. Moving among descendants of one label is de-duplicated.
 */
export declare function defineWikilinkHoverHandler(onHoverChange: WikilinkHoverHandler, openDelay?: number, closeDelay?: number): PlainExtension;
//#endregion
//#region src/extensions/wikilink-trigger.d.ts
/**
 * Binds `Mod-Shift-k` to open the wikilink menu, and `[` to wrap a selected
 * phrase into an open wikilink (`[[phrase`) with the menu searching it.
 */
export declare function defineWikilinkTrigger(enabled?: (state: EditorState) => boolean): PlainExtension;
//#endregion
//#region src/utils/composition.d.ts
export declare function getIsComposing(): boolean;
//#endregion
//#region src/utils/display-text.d.ts
/**
 * The textblock as its live-preview marks display it: syntax runs are
 * omitted and each atom unit is replaced by its display text.
 */
export declare function getTextblockDisplayText(textblock: ProseMirrorNode): string;
//#endregion
//#region src/utils/format-file-size.d.ts
/**
 * Format a byte count for display on a file pill: decimal units (1 KB =
 * 1000 B, matching macOS Finder), one decimal below 10, integers otherwise.
 */
export declare function formatFileSize(bytes: number): string;
//#endregion
//#region src/utils/is-mod-event.d.ts
/**
 * Whether the platform's mod key is held on `event`: `Command` on Apple, `Ctrl` elsewhere.
 */
export declare function isModEvent(event: MouseEvent | KeyboardEvent | TouchEvent | {
  metaKey: boolean;
  ctrlKey: boolean;
}): boolean;
//#endregion
//#region src/utils/katex-chunk.d.ts
type KaTeXRender = typeof render;
//#endregion
//#region src/utils/katex.d.ts
/**
 * Load KaTeX's render function on first use and cache it. Most documents
 * contain no math, so the library stays out of the initial bundle.
 */
export declare function loadKaTeX(): Promise<KaTeXRender>;
/**
 * Render TeX into `element` as native MathML (no KaTeX stylesheet or fonts
 * required). `throwOnError: false` renders parse errors as red text; the
 * catch covers the rare non-parse error so a bad formula can never crash a
 * render.
 */
export declare function renderMathInto(katexRender: KaTeXRender, element: HTMLElement, formula: string, displayMode: boolean): void;
//#endregion
//#region src/utils/selected-text.d.ts
/**
 * The current selection as Markdown: block structure (list markers, headings,
 * blockquotes) is serialized, and inline Markdown syntax is already literal
 * text in the document. A selection inside one textblock comes back as its
 * bare text; a multi-block selection keeps its block markers, so downstream
 * consumers (e.g. an AI prompt) see the same Markdown the user would.
 */
export declare function getSelectedText(state: EditorState): string;
//#endregion
//#region src/utils/virtual-element.d.ts
/**
 * Returns a Floating-UI virtual element tracking a document range.
 *
 * Positioning libraries re-measure asynchronously (resize observers, animation
 * frames), so a measurement can fire after the view is destroyed or the range
 * no longer resolves; those return the last known rect instead of throwing.
 */
export declare function getVirtualElementFromRange(view: EditorView, range: PositionRange): VirtualElement;
//#endregion
export { type AcceptPendingReplacementOptions, type CheckRoundTripOptions, type CodeBlockAttrs, type CodeBlockFenceStyle, type CodeToken, type DocToMarkdownOptions, type EditorConfig, type EditorExtension, type EditorExtensionOptions, type ExitBoundaryHandler, type ExitBoundaryOptions, type FileClickHandler, type FileClickPayload, type FileInfo, type FileInfoResolver, type FileLinkOptions, type FileLinkPayload, type FileLinkResolver, type FilePasteHandler, type FilePasteOptions, type FileSaveErrorHandler, type FileViewOptions, type FollowLinkHandlers, type ImageClickHandler, type ImageClickPayload, type ImageOptions, type InlineMarkContext, type InlineMarkOptions, type KaTeXRender, type LanguageItem, type LinkAttrs, type LinkClickHandler, type LinkClickPayload, type LinkCopyHandler, type LinkCopyPayload, type LinkEditHandler, type LinkEditOptions, type LinkHoverHandler, type LinkHoverOptions, type LinkPreview, type LinkPreviewResolver, type LinkUnit, type ListMarker, type MarkChunk, type MarkMode, type MarkName, type MarkdownToDocOptions, type MdFileAttrs, type MdImageAttrs, type MdLinkTextAttrs, type MdMathAttrs, type MdWikilinkAttrs, type MeowdownCodeBlockAttrs, type MeowdownHTMLCommentAttrs, type MeowdownListAttrs, type MeowdownTableCellAttrs, type NodeName, type ParsedWikiEmbed, type PendingReplacement, type PendingReplacementEvent, type PendingReplacementHandler, type PendingReplacementMode, type PendingReplacementOutcome, type PlaceholderOptions, type PositionRange, type PostEmbedSnapshot, Priority, type ReferenceDefinition, type ReferenceDefinitionIndex, type ReferenceDefinitions, type RoundTripFidelity, type SearchStatus, type SearchStatusHandler, type StartPendingReplacementOptions, type TableColumnAlign, type TagClickHandler, type TagClickPayload, type TypedEditor, type TypedMarkBuilders, type VirtualElement, type WikiEmbedOptions, type WikiEmbedResolution, type WikiEmbedResolver, type WikilinkClickHandler, type WikilinkClickPayload, type WikilinkHoverHandler, type WikilinkHoverHit, type WikilinkOptions, type WikilinkPayload, type WikilinkResolution, type WikilinkResolver, type XPostMediaClickHandler, type XPostResolver, type YouTubeVideoClickHandler, type YouTubeVideoResolver, defineCodeBlockPreviewPlugin, definePlaceholder, defineSearchStatusHandler, getSearchStatus, isCodeBlockPreviewHiddenDecoration, withPriority };