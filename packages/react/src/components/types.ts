import type {
  PendingReplacement,
  PendingReplacementOutcome,
  StartPendingReplacementOptions,
  TypedEditor,
} from '@meowdown/core'
import type { SelectionJSON } from '@prosekit/core'

/** A selection to restore: an exact JSON selection, or a document edge. */
export type SelectionHint = SelectionJSON | 'start' | 'end'

/**
 * The current Markdown and selection. Selection positions are in the mounted
 * editor's coordinate space and are not portable across editors.
 */
export type EditorStateSnapshot = [markdown: string, selection: SelectionJSON]

export interface EditorHandle {
  /**
   * Serializes the current document to Markdown. Can be expensive on large
   * documents; call it on demand (e.g. throttled) instead of on every change.
   */
  getMarkdown: () => string

  /** Replaces the whole document as a single undoable edit. */
  setMarkdown: (markdown: string) => void

  /**
   * Parses `markdown` and inserts it at the current selection as a single
   * undoable edit, replacing any selected content. A lone paragraph is
   * inserted inline at the cursor; anything else is inserted as blocks. The
   * cursor lands at the end of the inserted content. An empty or
   * whitespace-only string is a no-op. Unlike `setMarkdown`, it fires
   * `onDocChange`: the host cannot know the resulting document.
   */
  insertMarkdown: (markdown: string) => void

  /** Returns the current Markdown and selection. */
  getState: () => EditorStateSnapshot

  /**
   * Replaces the document (if `markdown` is given) and restores `selection`:
   * exactly when valid, otherwise clamped to the nearest text selection;
   * out-of-range positions never throw. Without a selection, the current one
   * is mapped through the change.
   */
  setState: (markdown?: string, selection?: SelectionHint) => void

  /** Returns the current selection. */
  getSelection: () => SelectionJSON

  /** Restores a selection with the same hint semantics as `setState`. */
  setSelection: (selection: SelectionHint) => void

  /** Focuses the editor. */
  focus: () => void

  /** Scrolls the selection into view. */
  scrollIntoView: () => void

  /**
   * The plain text of the current selection, with block boundaries as blank
   * lines. Inline Markdown syntax is literal text, so the result reads as
   * Markdown for inline content.
   */
  getSelectedText: () => string

  /**
   * Opens the selection menu over the current selection. A no-op when the
   * selection is empty or `onSelectionMenuSearch` is not set.
   */
  openSelectionMenu: () => void

  /**
   * Stages a pending replacement over a document range. Returns `false` when
   * the range is invalid. Calling it again resets the accumulated text, which
   * is how a retry starts.
   */
  startPendingReplacement: (options: StartPendingReplacementOptions) => boolean

  /** Appends streamed text to the staged replacement. */
  appendPendingReplacementText: (text: string) => void

  /** Applies the staged replacement to the document as a single edit. */
  acceptPendingReplacement: () => void

  /** Clears the staged replacement without touching the document. */
  discardPendingReplacement: () => void

  /**
   * Escape hatch: the underlying ProseKit editor, or `undefined` when the
   * handle does not wrap one.
   */
  readonly editor: TypedEditor | undefined
}

/** One row of host items in the slash menu. The host ranks the rows; the menu does not re-sort. */
export interface SlashMenuItem {
  /** Stable row key; defaults to `label`. */
  id?: string
  /** Display text, matched against the typed query like the built-in items. */
  label: string
  /** Secondary text shown beside the label. */
  detail?: string
  /** Runs after the menu closes and the typed `/query` text is removed. */
  onSelect: () => void
}

/**
 * Searches host items for the slash menu. Receives the query typed after `/`
 * (lowercased, punctuation stripped; may be empty) and returns the rows to
 * show after the built-in items, either synchronously or as a promise.
 */
export type SlashMenuSearchHandler = (query: string) => SlashMenuItem[] | Promise<SlashMenuItem[]>

/** One row in the tag menu. The host ranks the rows; the menu does not re-sort. */
export interface TagItem {
  /** Inserted as `#tag `. */
  tag: string
  /** Display text; defaults to `#tag`. */
  label?: string
  /** Secondary text shown beside the label. */
  detail?: string
  /** Side effect run after the tag is inserted (e.g. create the tag). */
  onSelect?: () => void
}

/**
 * Searches tags for the tag menu. Receives the query typed after `#`
 * (lowercased, punctuation stripped) and returns the rows to show, either
 * synchronously or as a promise.
 */
export type TagSearchHandler = (query: string) => TagItem[] | Promise<TagItem[]>

/** One row in the wikilink menu. The host ranks the rows; the menu does not re-sort. */
export interface WikilinkItem {
  /** Inserted as `[[target]]`. */
  target: string
  /** Display text; defaults to `target`. */
  label?: string
  /** Secondary text shown beside the label. */
  detail?: string
  /** Side effect run after the link is inserted (e.g. create the note). */
  onSelect?: () => void
}

/**
 * Searches notes for the wikilink menu. Receives the query typed after
 * `[[` or `@` (trimmed, with casing and punctuation preserved; may be empty
 * or contain spaces) and returns the rows to show, either synchronously or as
 * a promise.
 */
export type WikilinkSearchHandler = (query: string) => WikilinkItem[] | Promise<WikilinkItem[]>

/** The selection the selection menu was opened over. */
export interface SelectionMenuContext {
  /** The selected text, with block boundaries as blank lines. */
  selectedText: string
  /** Start of the selection. */
  from: number
  /** End of the selection. */
  to: number
}

/** One row in the selection menu. The host ranks the rows; the menu does not re-sort. */
export interface SelectionMenuItem {
  /** Stable identity for the row. */
  id: string
  /** Display text. */
  label: string
  /** Secondary text shown beside the label. */
  detail?: string
  /** Runs when the row is picked, with the selection the menu was opened over. */
  onSelect: (context: SelectionMenuContext) => void
}

/**
 * Searches commands for the selection menu. Receives the filter text typed in
 * the menu (may be empty) and the selection the menu was opened over, and
 * returns the rows to show, either synchronously or as a promise.
 */
export type SelectionMenuSearchHandler = (
  query: string,
  context: SelectionMenuContext,
) => SelectionMenuItem[] | Promise<SelectionMenuItem[]>

/** Reports how a pending replacement ended and its final staged value. */
export type PendingReplacementResolveHandler = (
  outcome: PendingReplacementOutcome,
  pending: PendingReplacement,
) => void
