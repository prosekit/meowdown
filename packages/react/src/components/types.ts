import type { LinkHit, WikilinkHit } from '@meowdown/core'
import type { SelectionJSON } from '@prosekit/core'
import type { ReactNode } from 'react'

export type {
  LinkClickContext,
  LinkClickHandler,
  WikilinkClickContext,
  WikilinkClickHandler,
} from '@meowdown/core'

/** A selection to restore: an exact JSON selection, or a document edge. */
export type SelectionHint = SelectionJSON | 'start' | 'end'

/**
 * The current Markdown and selection. Selection positions are in the mounted
 * editor's coordinate space: ProseMirror positions in the rich modes,
 * character offsets in source mode. Not portable across a mode switch.
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
}

/**
 * Searches tags for the tag menu. Receives the query typed after `#`
 * (lowercased, punctuation stripped) and returns the tags to show, either
 * synchronously or as a promise.
 */
export type TagSearchHandler = (query: string) => string[] | Promise<string[]>

/**
 * Searches notes for the wikilink menu. Receives the query typed after
 * `[[` (lowercased, punctuation stripped, may be empty or contain spaces)
 * and returns the note names to show, either synchronously or as a promise.
 */
export type WikilinkSearchHandler = (query: string) => string[] | Promise<string[]>

/** Context passed to a {@link LinkHoverHandler}. */
export interface LinkHoverContext extends LinkHit {
  /** Aborts when the pointer leaves before an async card resolves. */
  signal: AbortSignal
}

/** Context passed to a {@link WikilinkHoverHandler}. */
export interface WikilinkHoverContext extends WikilinkHit {
  /** Aborts when the pointer leaves before an async card resolves. */
  signal: AbortSignal
}

/**
 * What a hover handler returns: a React node (or a promise of one) to fill the
 * card, `null` / `undefined` for the built-in default card, or `false` to show
 * no card.
 */
export type HoverCardResult = ReactNode | Promise<ReactNode | null> | null | false

/**
 * Builds the hover card for a Markdown link. Runs while the editor is focused
 * and the pointer dwells on a link. Return a node (or a promise of one) to fill
 * the card; return nothing for the built-in card; `false` for none.
 */
export type LinkHoverHandler = (context: LinkHoverContext) => HoverCardResult

/** Builds the hover card for a wikilink. Same contract as {@link LinkHoverHandler}. */
export type WikilinkHoverHandler = (context: WikilinkHoverContext) => HoverCardResult
