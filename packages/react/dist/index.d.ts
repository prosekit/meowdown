import { ReactElement, ReactNode, Ref } from "react";
import { AcceptPendingReplacementOptions, ExitBoundaryHandler, FileClickHandler, FileInfoResolver, FileLinkResolver, FilePasteOptions, FileViewOptions, ImageClickHandler, ImageOptions, LinkClickHandler, LinkCopyHandler, ListMarker, MarkMode, PendingReplacement, PendingReplacementOutcome, PlaceholderOptions, SearchStatusHandler, StartPendingReplacementOptions, TagClickHandler, TypedEditor, WikiEmbedResolver, WikilinkClickHandler, WikilinkHoverHit } from "@meowdown/core";
import { SelectionJSON, SelectionJSON as SelectionJSON$1 } from "@prosekit/core";
import { useEditor, useExtension, useKeymap } from "@prosekit/react";
//#region src/utils/date-format.d.ts
type TimeFormat = '12' | '24';
//#endregion
//#region src/components/types.d.ts
/** A selection to restore: an exact JSON selection, or a document edge. */
type SelectionHint = SelectionJSON$1 | 'start' | 'end';
/**
 * The current Markdown and selection. Selection positions are in the mounted
 * editor's coordinate space and are not portable across editors.
 */
type EditorStateSnapshot = [markdown: string, selection: SelectionJSON$1];
/**
 * The imperative API of a mounted editor: read and write the document,
 * move the selection, and drive the selection menu and pending replacements
 * from outside React.
 */
interface EditorHandle {
  /**
   * Serializes the current document to Markdown. Can be expensive on large
   * documents; call it on demand (e.g. throttled) instead of on every change.
   */
  getMarkdown: () => string;
  /** Replaces the whole document as a single undoable edit. */
  setMarkdown: (markdown: string) => void;
  /**
   * Parses `markdown` and inserts it at the current selection as a single
   * undoable edit. An active selection collapses first and is never
   * deleted - this is a host-initiated insert, not a paste. A lone paragraph is
   * inserted inline at the cursor; anything else is inserted as blocks. The
   * cursor lands at the end of the inserted content. An empty or
   * whitespace-only string is a no-op. Unlike `setMarkdown`, it fires
   * `onDocChange`: the host cannot know the resulting document.
   */
  insertMarkdown: (markdown: string) => void;
  /** Returns the current Markdown and selection. */
  getState: () => EditorStateSnapshot;
  /**
   * Replaces the document (if `markdown` is given) and restores `selection`:
   * exactly when valid, otherwise clamped to the nearest text selection;
   * out-of-range positions never throw. Without a selection, the current one
   * is mapped through the change.
   */
  setState: (markdown?: string, selection?: SelectionHint) => void;
  /**
   * Reparse the current Markdown with the editor's creation-time resolvers,
   * preserving the selection without adding an undo-history entry. Hosts use
   * this when data consulted by a stable resolver changes out of band.
   */
  refreshMarkdownRendering: () => void;
  /** Returns the current selection. */
  getSelection: () => SelectionJSON$1;
  /** Restores a selection with the same hint semantics as `setState`. */
  setSelection: (selection: SelectionHint) => void;
  /** Focuses the editor. */
  focus: () => void;
  /** Scrolls the selection into view. */
  scrollIntoView: () => void;
  /**
   * Moves the selection to the first heading matching a decoded `#fragment`
   * (case-insensitive, with whitespace collapsed) and scrolls it into view.
   * Returns `false` when no heading matches.
   */
  revealHeading: (fragment: string) => boolean;
  /**
   * The current selection as Markdown: block structure (list markers,
   * headings) is serialized, and inline syntax is already literal text. A
   * selection inside one textblock comes back as its bare text.
   */
  getSelectedText: () => string;
  /**
   * Opens the selection menu over the current selection. A no-op when the
   * selection is empty or `onSelectionMenuSearch` is not set.
   */
  openSelectionMenu: () => void;
  /**
   * Stages a pending replacement over a document range. Returns `false` when
   * the range is invalid. Calling it again resets the accumulated text, which
   * is how a retry starts.
   */
  startPendingReplacement: (options: StartPendingReplacementOptions) => boolean;
  /** Appends streamed text to the staged replacement. */
  appendPendingReplacementText: (text: string) => void;
  /**
   * Applies the staged replacement to the document as a single edit. Pass a
   * `mode` to override the staged placement for this accept (e.g. "Insert
   * below" on a replace stage).
   */
  acceptPendingReplacement: (options?: AcceptPendingReplacementOptions) => void;
  /** Clears the staged replacement without touching the document. */
  discardPendingReplacement: () => void;
  /** Selects the next match of the current search query, wrapping at the document end. */
  findNext: () => void;
  /** Selects the previous match of the current search query, wrapping at the document start. */
  findPrevious: () => void;
  /**
   * Escape hatch: the underlying ProseKit editor, or `undefined` when the
   * handle does not wrap one.
   */
  readonly editor: TypedEditor | undefined;
}
/** One row of host items in the slash menu. The host ranks the rows; the menu does not re-sort. */
interface SlashMenuItem {
  /** Stable row key; defaults to `label`. */
  id?: string;
  /** Display text, matched against the typed query like the built-in items. */
  label: string;
  /** Extra match terms beyond the label; never displayed. */
  keywords?: string[];
  /** Secondary text shown beside the label. */
  detail?: string;
  /** Runs after the menu closes and the typed `/query` text is removed. */
  onSelect: () => void;
}
/**
 * Searches host items for the slash menu. Receives the query typed after `/`
 * (lowercased, punctuation stripped; may be empty) and returns the rows to
 * show after the built-in items, either synchronously or as a promise.
 */
type SlashMenuSearchHandler = (query: string) => SlashMenuItem[] | Promise<SlashMenuItem[]>;
/** One row in the tag menu. The host ranks the rows; the menu does not re-sort. */
interface TagItem {
  /** Inserted as `#tag `. */
  tag: string;
  /** Display text; defaults to `#tag`. */
  label?: string;
  /** Secondary text shown beside the label. */
  detail?: string;
  /** Side effect run after the tag is inserted (e.g. create the tag). */
  onSelect?: () => void;
}
/**
 * Searches tags for the tag menu. Receives the query typed after `#`
 * (lowercased, punctuation stripped) and returns the rows to show, either
 * synchronously or as a promise.
 */
type TagSearchHandler = (query: string) => TagItem[] | Promise<TagItem[]>;
/** One row in the wikilink menu. The host ranks the rows; the menu does not re-sort. */
interface WikilinkItem {
  /** Inserted as `[[target]]`. */
  target: string;
  /** Display text; defaults to `target`. */
  label?: string;
  /** Secondary text shown beside the label. */
  detail?: string;
  /** Side effect run after the link is inserted (e.g. create the note). */
  onSelect?: () => void;
}
/**
 * Searches notes for the wikilink menu. Receives the query typed after
 * `[[` or `@` (trimmed, with casing and punctuation preserved; may be empty
 * or contain spaces) and returns the rows to show, either synchronously or as
 * a promise.
 */
type WikilinkSearchHandler = (query: string) => WikilinkItem[] | Promise<WikilinkItem[]>;
/** The selection the selection menu was opened over. */
interface SelectionMenuContext {
  /** The selected text, with block boundaries as blank lines. */
  selectedText: string;
  /** Start of the selection. */
  from: number;
  /** End of the selection. */
  to: number;
}
/** One row in the selection menu. The host ranks the rows; the menu does not re-sort. */
interface SelectionMenuItem {
  /** Stable identity for the row. */
  id: string;
  /** Display text. */
  label: string;
  /** Secondary text shown beside the label. */
  detail?: string;
  /** Runs when the row is picked, with the selection the menu was opened over. */
  onSelect: (context: SelectionMenuContext) => void;
}
/**
 * Searches commands for the selection menu. Receives the filter text typed in
 * the menu (may be empty) and the selection the menu was opened over, and
 * returns the rows to show, either synchronously or as a promise.
 */
type SelectionMenuSearchHandler = (query: string, context: SelectionMenuContext) => SelectionMenuItem[] | Promise<SelectionMenuItem[]>;
/** Reports how a pending replacement ended and its final staged value. */
type PendingReplacementResolveHandler = (outcome: PendingReplacementOutcome, pending: PendingReplacement) => void;
//#endregion
//#region src/components/editor.d.ts
type EditorMode = MarkMode;
interface EditorProps {
  /**
   * The editor mode ('focus', 'show', 'hide'), controlling how much Markdown
   * syntax stays in view. Defaults to 'focus'.
   */
  mode?: EditorMode;
  /**
   * The initial Markdown text of the editor. Only the value provided on the
   * first render is used; later changes are ignored.
   */
  initialMarkdown?: string;
  /**
   * Called on every user-driven document change. Programmatic `setMarkdown` and
   * `setState` on the handle do not fire it.
   */
  onDocChange?: VoidFunction;
  /**
   * Searches host items for the slash menu, which opens when typing `/`.
   * Receives the query (lowercased, punctuation stripped, may be empty) and
   * returns the items to show after the built-in ones, synchronously or as a
   * promise. Selecting an item removes the typed `/query` text before its
   * `onSelect` runs, so `onSelect` can insert at the cursor (e.g. via the
   * handle's `insertMarkdown`). Pass a stable function (e.g. from
   * `useCallback`). Omit to show only the built-in items.
   */
  onSlashMenuSearch?: SlashMenuSearchHandler;
  /**
   * Searches tags for the tag menu, which opens when typing `#` followed by
   * text. Receives the query (lowercased, punctuation stripped) and returns the
   * tags to show, synchronously or as a promise. Pass a stable function (e.g.
   * from `useCallback`). Omit to disable the tag menu.
   */
  onTagSearch?: TagSearchHandler;
  /**
   * Searches notes for the wikilink menu, which opens as soon as `[[` or `@`
   * is typed. Receives the query (trimmed, with casing and punctuation
   * preserved, may be empty) and returns the note names to show, synchronously
   * or as a promise. Pass a stable function (e.g. from `useCallback`). Omit to
   * disable the wikilink menu.
   */
  onWikilinkSearch?: WikilinkSearchHandler;
  /**
   * Searches commands for the selection menu, which opens over a non-empty
   * selection via `EditorHandle.openSelectionMenu()` or the selection
   * affordance. Receives the filter text typed in the menu (may be empty) and
   * the selection the menu was opened over, and returns the rows to show,
   * synchronously or as a promise. The host ranks the rows; the menu does not
   * re-sort. Pass a stable function (e.g. from `useCallback`). Omit to disable
   * the selection menu.
   */
  onSelectionMenuSearch?: SelectionMenuSearchHandler;
  /**
   * Shows a small floating button on a non-empty text selection that opens the
   * selection menu. On by default; only relevant when `onSelectionMenuSearch`
   * is set. Ignored when `readOnly` is set.
   */
  selectionMenuAffordance?: boolean;
  /**
   * Extra controls rendered in the pending-replacement preview footer, next to
   * the built-in accept ("Replace selection" / "Insert below", per the staged
   * mode) and Discard buttons (e.g. a retry button).
   */
  pendingReplacementActions?: ReactNode;
  /**
   * Called when a pending replacement ends, with the outcome ('accepted' or
   * 'discarded') and the final staged value. Use it to stop a stream that is
   * still appending. Pass a stable function (e.g. from `useCallback`).
   */
  onPendingReplacementResolve?: PendingReplacementResolveHandler;
  /**
   * Called with the link target on click of a rendered wiki link, or on
   * `Mod-Enter` with the caret on one. Pass a stable function (e.g. from
   * `useCallback`).
   */
  onWikilinkClick?: WikilinkClickHandler;
  /**
   * Called with the link `href` on click of a rendered Markdown link
   * (`[text](url)`), or on `Mod-Enter` with the caret on one. Pass a stable
   * function (e.g. from `useCallback`).
   */
  onLinkClick?: LinkClickHandler;
  /**
   * Called after a link is copied from the link menu, with its `href`. Useful
   * for a toast. Pass a stable function (e.g. from `useCallback`).
   */
  onLinkCopy?: LinkCopyHandler;
  /**
   * Called with the tag name (without the leading `#`) on click of a rendered
   * `#tag`, or on `Mod-Enter` with the caret on one. Pass a stable function
   * (e.g. from `useCallback`).
   */
  onTagClick?: TagClickHandler;
  /**
   * Called when the caret can move no further in the pressed arrow direction
   * and leaves the document boundary: ArrowUp on the first visual line,
   * ArrowDown on the last, or an arrow press on a selected node at the edge.
   * Use it to move focus to a previous/next note or page. Receives the
   * `direction` and the original `KeyboardEvent`. Return `false` to let the
   * editor handle the key normally; any other return value consumes it. Pass a
   * stable function (e.g. from `useCallback`).
   */
  onExitBoundary?: ExitBoundaryHandler;
  /**
   * Maps an image `src` to a displayable URL, or `undefined` to skip that image.
   * Defaults to showing http(s) URLs as-is. Pass a stable function (e.g. from
   * `useCallback`).
   */
  resolveImageUrl?: ImageOptions['resolveImageUrl'];
  /**
   * Claims a `[label](url)` link as a file: a claimed link renders as an
   * inline pill (file icon, name, size) instead of a link, behaves as one
   * caret unit, and reports clicks through `onFileClick` instead of
   * `onLinkClick`. The markdown text is untouched. Must be pure (same link,
   * same answer). Read once when the editor is created: later identity
   * changes are ignored, like `initialMarkdown`.
   */
  resolveFileLink?: FileLinkResolver;
  /**
   * Classifies `![[target]]` as an image, file, or note atom. Return
   * `undefined` for missing or ambiguous targets to leave the source literal
   * and editable. Must be pure and is read once when the editor is created.
   */
  resolveWikiEmbed?: WikiEmbedResolver;
  /**
   * Resolves the metadata (file size in bytes) shown on a file pill, directly
   * or as a promise; the pill renders immediately and fills the size in when
   * the promise settles. May be called repeatedly for the same `href`, so
   * cache in the host when resolving is expensive. Pass a stable function
   * (e.g. from `useCallback`).
   */
  resolveFileInfo?: FileViewOptions['resolveFileInfo'];
  /**
   * Called when the user clicks a rendered file pill (or presses `Mod-Enter`
   * with the caret on one), with its `href`, `name`, and the originating
   * event. The host decides what a click does (e.g. open the file in the OS
   * default app). Pass a stable function (e.g. from `useCallback`).
   */
  onFileClick?: FileClickHandler;
  /**
   * Persists a pasted/dropped file and returns its markdown destination,
   * inserted as `![](src)` for an image and as a `[name](src)` link for any
   * other file. Return `undefined` to decline. Pass a stable function.
   */
  onFilePaste?: FilePasteOptions['onFilePaste'];
  /** Called when persisting a pasted/dropped file throws. */
  onFileSaveError?: FilePasteOptions['onFileSaveError'];
  /**
   * Called when the user clicks a rendered image, with its markdown `src`,
   * `alt`, and the originating `MouseEvent`. Pass a stable function (e.g. from
   * `useCallback`).
   */
  onImageClick?: ImageClickHandler;
  /**
   * Auto-embeds a pasted tweet or YouTube link as a rich embed; one undo turns
   * the embed back into the raw link. On by default.
   */
  embedPaste?: boolean;
  /**
   * Pasting a URL over selected text wraps the selection as a Markdown link
   * `[selected text](url)`; one undo restores the plain text. On by default.
   */
  linkPaste?: boolean;
  /**
   * Pressing Enter at the end of the document's first heading (the title line)
   * starts a fresh empty bullet on the next line instead of a plain paragraph.
   * Off by default.
   */
  bulletAfterHeading?: boolean;
  /**
   * Replaces typed character sequences with their typographic equivalents,
   * e.g. `->` with `→` and `(c)` with `©`. On by default.
   */
  substitution?: boolean;
  /** Handles a leading `---` frontmatter block (off by default). */
  frontmatter?: boolean;
  /**
   * Shows the per-block gutter handle: a drag grip for reordering blocks and a
   * "+" add button, plus the drop indicator that visualizes where a dragged
   * block will land. On by default. Set to `false` to hide the gutter
   * affordance entirely, e.g. when the host does not want block reordering.
   * Ignored when `readOnly` is set.
   */
  blockHandle?: boolean;
  /**
   * Glides the caret between positions instead of jumping instantly. On by
   * default. Set to `false` to disable the movement animation; equivalent to
   * setting the `--meowdown-caret-glide` CSS variable to `0ms`.
   */
  caretGlide?: boolean;
  /**
   * Placeholder text shown when the whole document is empty. A function
   * receives the editor state. Pass a stable function.
   */
  placeholder?: PlaceholderOptions['placeholder'];
  /** Makes the editor read-only. */
  readOnly?: boolean;
  /**
   * Enables the browser's native spell checking. Defaults to the browser's
   * behavior.
   */
  spellCheck?: boolean;
  /**
   * The search query. Every match is highlighted, and the first match at or
   * after the caret is selected whenever the query changes. An empty string
   * (the default) clears the highlights and leaves the selection alone. A match
   * that the current mode hides reveals itself while it is the selected one.
   */
  searchQuery?: string;
  /**
   * Called when the number of matches or the selected match changes. Pass a
   * stable function (e.g. from `useCallback`).
   */
  onSearchChange?: SearchStatusHandler;
  /**
   * Clock format the `/now` slash command inserts: '12' for "3:45pm" or '24'
   * for "15:45". Defaults to '12'.
   */
  timeFormat?: TimeFormat;
  /** Class on the editable root (the contenteditable). */
  editorClassName?: string;
  /** Class on the outer `.meowdown` wrapper div. */
  wrapperClassName?: string;
  /** Imperative handle for the editor. */
  handleRef?: Ref<EditorHandle>;
  /** Nodes rendered inside the editor's ProseKit context. */
  children?: ReactNode;
}
/**
 * A hybrid live-preview Markdown editor: the document stays Markdown text,
 * rendered in place as rich content.
 *
 * Callbacks and resolvers should be stable; pass them via `useCallback`.
 */
declare function MeowdownEditor({ mode, initialMarkdown, onDocChange, onSlashMenuSearch, onTagSearch, onWikilinkSearch, onSelectionMenuSearch, selectionMenuAffordance, pendingReplacementActions, onPendingReplacementResolve, onWikilinkClick, onLinkClick, onLinkCopy, onTagClick, onExitBoundary, resolveImageUrl, resolveFileLink, resolveWikiEmbed, resolveFileInfo, onFileClick, onFilePaste, onFileSaveError, onImageClick, embedPaste, linkPaste, bulletAfterHeading, substitution, frontmatter, blockHandle, caretGlide, placeholder, readOnly, spellCheck, searchQuery, onSearchChange, timeFormat, editorClassName, wrapperClassName, handleRef, children }: EditorProps): ReactElement;
//#endregion
//#region src/components/markdown-view.d.ts
/** Payload for {@link TaskClickHandler}. */
interface TaskClickPayload {
  /**
   * Zero-based position of the clicked checkbox among all the checkboxes this
   * view renders, in document order. Stable for a given `markdown`, so a host
   * can map it back to the corresponding task item in its own parse of the
   * same source.
   */
  index: number;
  /** The checkbox's rendered state. The view never flips it — see the handler doc. */
  checked: boolean;
  /** The item's list marker as written (`+` renders a circle checkbox, `-`/`*` a square). */
  marker: ListMarker;
  /**
   * First line of the item's own inline content, exactly as it appears in the
   * source after the `[ ]`/`[x]` marker and one space. A host locating the task
   * by {@link index} can cross-check this against its own parse and refuse a
   * mismatch instead of toggling the wrong item.
   */
  text: string;
  /** The originating click. Read modifier keys or position a popover from it. */
  event: globalThis.MouseEvent;
}
/**
 * Called when a rendered task checkbox is clicked. The view is a pure render
 * of `markdown` and never flips the box itself: apply the toggle to the
 * source and re-render, exactly like the other click handlers.
 */
type TaskClickHandler = (payload: TaskClickPayload) => void;
interface MarkdownViewProps {
  /** The Markdown to render. Live: changing it re-renders the content. */
  markdown: string;
  /** Mark mode for the read-only view. Defaults to `'hide'`. */
  markMode?: MarkMode;
  /** Peel a leading YAML frontmatter block before rendering. Off by default. */
  frontmatter?: boolean;
  /**
   * Whether rendered links, images, file pills, and task checkboxes can be activated.
   * Defaults to `true`. When `false`, callbacks are ignored, the rendered tree
   * contains no anchors or focusable task controls, and recognized tweet and
   * YouTube embeds are omitted before any image resolver runs.
   */
  interactive?: boolean;
  /**
   * Render collapsed (`+`) bullets expanded, ignoring their fold state at any
   * depth. Off by default. For views that show slices of a note (e.g. a
   * backlinks panel), where the source's fold state must not hide the content
   * the view exists to show.
   */
  expandCollapsed?: boolean;
  /** Map an image `src` to a displayable URL, or `undefined` to skip it. */
  resolveImageUrl?: (src: string) => string | undefined;
  /**
   * Claim a `[label](url)` link as a file pill instead of a regular link.
   * Must be pure; return `false` for links that should render normally.
   */
  resolveFileLink?: FileLinkResolver;
  /** Classify `![[target]]` as an image, file, or note; unresolved source stays literal. */
  resolveWikiEmbed?: WikiEmbedResolver;
  /** Resolve metadata shown on a file pill. */
  resolveFileInfo?: FileInfoResolver;
  /** Called when a rendered wikilink is clicked. Pass a stable function. */
  onWikilinkClick?: WikilinkClickHandler;
  /** Called when a rendered Markdown link is clicked. Pass a stable function. */
  onLinkClick?: LinkClickHandler;
  /** Called when a rendered image is clicked. Pass a stable function. */
  onImageClick?: ImageClickHandler;
  /** Called when a rendered file pill is clicked. Pass a stable function. */
  onFileClick?: FileClickHandler;
  /** Called when a rendered task checkbox is clicked. Pass a stable function. */
  onTaskClick?: TaskClickHandler;
  /** Extra class on the content root (alongside `ProseMirror meowdown-content`). */
  className?: string;
}
/**
 * Render Markdown to a read-only React tree that looks exactly like the editor
 * in `hide` mark mode: inline marks, wikilink chips, images, tweet/YouTube
 * embeds, and syntax-highlighted code. No editor, no ProseMirror view; just a
 * walk over `markdownToDoc`'s document reusing meowdown's own parse, mark logic,
 * and CSS (the root carries `ProseMirror` + `data-mark-mode` so the existing
 * stylesheet applies). Requires a DOM environment.
 *
 * Callbacks (`onWikilinkClick`, etc.) and resolvers should be stable; pass them via
 * `useCallback` to avoid re-rendering the whole tree.
 */
declare function MarkdownView({ markdown, markMode, frontmatter, interactive, expandCollapsed, resolveImageUrl, resolveFileLink, resolveWikiEmbed, resolveFileInfo, onWikilinkClick, onLinkClick, onImageClick, onFileClick, onTaskClick, className }: MarkdownViewProps): ReactElement;
//#endregion
//#region src/components/wikilink-hover-card.d.ts
/** Props for {@link WikilinkHoverCard}. */
interface WikilinkHoverCardProps {
  /**
   * Render the card body from the hovered wiki link. Returning `null` renders
   * no card. A returned promise keeps the card closed until it resolves;
   * resolving to `null` or rejecting renders no card, and a result that lands
   * after the pointer moved on is discarded. The function runs once per
   * hovered link rather than on every render, and a new function identity
   * re-runs it for the current link.
   */
  readonly children: (hit: WikilinkHoverHit) => ReactNode | Promise<ReactNode>;
  /** Optional class applied to the popup, after the default card surface. */
  readonly className?: string;
}
/**
 * Show host-rendered content after a 300ms dwell over a rendered wiki link.
 */
declare function WikilinkHoverCard({ children, className }: WikilinkHoverCardProps): ReactNode;
//#endregion
export { type EditorHandle, type EditorMode, type EditorProps, type EditorStateSnapshot, MarkdownView, type MarkdownViewProps, MeowdownEditor, type PendingReplacementResolveHandler, type SelectionHint, type SelectionJSON, type SelectionMenuContext, type SelectionMenuItem, type SelectionMenuSearchHandler, type SlashMenuItem, type SlashMenuSearchHandler, type TagItem, type TagSearchHandler, type TaskClickHandler, type TaskClickPayload, type TimeFormat, WikilinkHoverCard, type WikilinkHoverCardProps, type WikilinkItem, type WikilinkSearchHandler, useEditor, useExtension, useKeymap };