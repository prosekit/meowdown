import type { TypedEditor } from '@meowdown/core'
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
   * undoable edit. An active selection collapses first and is never
   * deleted — this is a host-initiated insert (a template), not a paste. A
   * lone paragraph is
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
  /**
   * Extra match terms beyond the label (never displayed) — e.g. every
   * template row matching the word "template" so typing `/template` lists
   * them all.
   */
  keywords?: string[]
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
