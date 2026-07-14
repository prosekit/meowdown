import type {
  AcceptPendingReplacementOptions,
  ExitBoundaryHandler,
  FileClickHandler,
  FileLinkResolver,
  FilePasteOptions,
  FileViewOptions,
  ImageClickHandler,
  ImageOptions,
  LinkClickHandler,
  LinkCopyHandler,
  MarkMode,
  PlaceholderOptions,
  StartPendingReplacementOptions,
  TagClickHandler,
  WikiEmbedResolver,
  WikilinkClickHandler,
} from '@meowdown/core'
import type { SelectionJSON } from '@prosekit/core'
import { clsx } from 'clsx/lite'
import { useImperativeHandle, useRef, type ReactNode, type Ref } from 'react'

import type { TimeFormat } from '../utils/date-format.ts'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type {
  EditorHandle,
  EditorStateSnapshot,
  PendingReplacementResolveHandler,
  SelectionHint,
  SelectionMenuSearchHandler,
  SlashMenuSearchHandler,
  TagSearchHandler,
  WikilinkSearchHandler,
} from './types.ts'

export type EditorMode = MarkMode

export interface EditorProps {
  /**
   * The editor mode ('focus', 'show', 'hide'), controlling how much Markdown
   * syntax stays in view. Defaults to 'focus'.
   */
  mode?: EditorMode

  /**
   * The initial Markdown text of the editor. Only the value provided on the
   * first render is used; later changes are ignored.
   */
  initialMarkdown?: string

  /**
   * Called on every user-driven document change. Programmatic `setMarkdown` and
   * `setState` on the handle do not fire it.
   */
  onDocChange?: VoidFunction

  /**
   * Searches host items for the slash menu, which opens when typing `/`.
   * Receives the query (lowercased, punctuation stripped, may be empty) and
   * returns the items to show after the built-in ones, synchronously or as a
   * promise. Selecting an item removes the typed `/query` text before its
   * `onSelect` runs, so `onSelect` can insert at the cursor (e.g. via the
   * handle's `insertMarkdown`). Pass a stable function (e.g. from
   * `useCallback`). Omit to show only the built-in items.
   */
  onSlashMenuSearch?: SlashMenuSearchHandler

  /**
   * Searches tags for the tag menu, which opens when typing `#` followed by
   * text. Receives the query (lowercased, punctuation stripped) and returns the
   * tags to show, synchronously or as a promise. Pass a stable function (e.g.
   * from `useCallback`). Omit to disable the tag menu.
   */
  onTagSearch?: TagSearchHandler

  /**
   * Searches notes for the wikilink menu, which opens as soon as `[[` or `@`
   * is typed. Receives the query (trimmed, with casing and punctuation
   * preserved, may be empty) and returns the note names to show, synchronously
   * or as a promise. Pass a stable function (e.g. from `useCallback`). Omit to
   * disable the wikilink menu.
   */
  onWikilinkSearch?: WikilinkSearchHandler

  /**
   * Searches commands for the selection menu, which opens over a non-empty
   * selection via `EditorHandle.openSelectionMenu()` or the selection
   * affordance. Receives the filter text typed in the menu (may be empty) and
   * the selection the menu was opened over, and returns the rows to show,
   * synchronously or as a promise. The host ranks the rows; the menu does not
   * re-sort. Pass a stable function (e.g. from `useCallback`). Omit to disable
   * the selection menu.
   */
  onSelectionMenuSearch?: SelectionMenuSearchHandler

  /**
   * Shows a small floating button on a non-empty text selection that opens the
   * selection menu. On by default; only relevant when `onSelectionMenuSearch`
   * is set. Ignored when `readOnly` is set.
   */
  selectionMenuAffordance?: boolean

  /**
   * Extra controls rendered in the pending-replacement preview footer, next to
   * the built-in accept ("Replace selection" / "Insert below", per the staged
   * mode) and Discard buttons (e.g. a retry button).
   */
  pendingReplacementActions?: ReactNode

  /**
   * Called when a pending replacement ends, with the outcome ('accepted' or
   * 'discarded') and the final staged value. Use it to stop a stream that is
   * still appending. Pass a stable function (e.g. from `useCallback`).
   */
  onPendingReplacementResolve?: PendingReplacementResolveHandler

  /**
   * Called with the link target on click of a rendered wiki link, or on
   * `Mod-Enter` with the caret on one. Pass a stable function (e.g. from
   * `useCallback`).
   */
  onWikilinkClick?: WikilinkClickHandler

  /**
   * Called with the link `href` on click of a rendered Markdown link
   * (`[text](url)`), or on `Mod-Enter` with the caret on one. Pass a stable
   * function (e.g. from `useCallback`).
   */
  onLinkClick?: LinkClickHandler

  /**
   * Called after a link is copied from the link menu, with its `href`. Useful
   * for a toast. Pass a stable function (e.g. from `useCallback`).
   */
  onLinkCopy?: LinkCopyHandler

  /**
   * Called with the tag name (without the leading `#`) on click of a rendered
   * `#tag`, or on `Mod-Enter` with the caret on one. Pass a stable function
   * (e.g. from `useCallback`).
   */
  onTagClick?: TagClickHandler

  /**
   * Called when the caret can move no further in the pressed arrow direction
   * and leaves the document boundary: ArrowUp on the first visual line,
   * ArrowDown on the last, or an arrow press on a selected node at the edge.
   * Use it to move focus to a previous/next note or page. Receives the
   * `direction` and the original `KeyboardEvent`. Return `false` to let the
   * editor handle the key normally; any other return value consumes it. Pass a
   * stable function (e.g. from `useCallback`).
   */
  onExitBoundary?: ExitBoundaryHandler

  /**
   * Maps an image `src` to a displayable URL, or `undefined` to skip that image.
   * Defaults to showing http(s) URLs as-is. Pass a stable function (e.g. from
   * `useCallback`).
   */
  resolveImageUrl?: ImageOptions['resolveImageUrl']

  /**
   * Claims a `[label](url)` link as a file: a claimed link renders as an
   * inline pill (file icon, name, size) instead of a link, behaves as one
   * caret unit, and reports clicks through `onFileClick` instead of
   * `onLinkClick`. The markdown text is untouched. Must be pure (same link,
   * same answer). Read once when the editor is created: later identity
   * changes are ignored, like `initialMarkdown`.
   */
  resolveFileLink?: FileLinkResolver

  /**
   * Classifies `![[target]]` as an image, file, or note atom. Return
   * `undefined` for missing or ambiguous targets to leave the source literal
   * and editable. Must be pure and is read once when the editor is created.
   */
  resolveWikiEmbed?: WikiEmbedResolver

  /**
   * Resolves the metadata (file size in bytes) shown on a file pill, directly
   * or as a promise; the pill renders immediately and fills the size in when
   * the promise settles. May be called repeatedly for the same `href`, so
   * cache in the host when resolving is expensive. Pass a stable function
   * (e.g. from `useCallback`).
   */
  resolveFileInfo?: FileViewOptions['resolveFileInfo']

  /**
   * Called when the user clicks a rendered file pill (or presses `Mod-Enter`
   * with the caret on one), with its `href`, `name`, and the originating
   * event. The host decides what a click does (e.g. open the file in the OS
   * default app). Pass a stable function (e.g. from `useCallback`).
   */
  onFileClick?: FileClickHandler

  /**
   * Persists a pasted/dropped file and returns its markdown destination,
   * inserted as `![](src)` for an image and as a `[name](src)` link for any
   * other file. Return `undefined` to decline. Pass a stable function.
   */
  onFilePaste?: FilePasteOptions['onFilePaste']

  /** Called when persisting a pasted/dropped file throws. */
  onFileSaveError?: FilePasteOptions['onFileSaveError']

  /**
   * Called when the user clicks a rendered image, with its markdown `src`,
   * `alt`, and the originating `MouseEvent`. Pass a stable function (e.g. from
   * `useCallback`).
   */
  onImageClick?: ImageClickHandler

  /**
   * Auto-embeds a pasted tweet or YouTube link as a rich embed; one undo turns
   * the embed back into the raw link. On by default.
   */
  embedPaste?: boolean

  /**
   * Pasting a URL over selected text wraps the selection as a Markdown link
   * `[selected text](url)`; one undo restores the plain text. On by default.
   */
  linkPaste?: boolean

  /**
   * Pressing Enter at the end of the document's first heading (the title line)
   * starts a fresh empty bullet on the next line instead of a plain paragraph.
   * Off by default.
   */
  bulletAfterHeading?: boolean

  /**
   * Replaces typed character sequences with their typographic equivalents,
   * e.g. `->` with `→` and `(c)` with `©`. On by default.
   */
  substitution?: boolean

  /** Handles a leading `---` frontmatter block (off by default). */
  frontmatter?: boolean

  /**
   * Shows the per-block gutter handle: a drag grip for reordering blocks and a
   * "+" add button, plus the drop indicator that visualizes where a dragged
   * block will land. On by default. Set to `false` to hide the gutter
   * affordance entirely, e.g. when the host does not want block reordering.
   * Ignored when `readOnly` is set.
   */
  blockHandle?: boolean

  /**
   * Placeholder text shown when the whole document is empty. A function
   * receives the editor state. Pass a stable function.
   */
  placeholder?: PlaceholderOptions['placeholder']

  /** Makes the editor read-only. */
  readOnly?: boolean

  /**
   * Enables the browser's native spell checking. Defaults to the browser's
   * behavior.
   */
  spellCheck?: boolean

  /**
   * Clock format the `/now` slash command inserts: '12' for "3:45pm" or '24'
   * for "15:45". Defaults to '12'.
   */
  timeFormat?: TimeFormat

  /** Class on the editable root (the contenteditable). */
  editorClassName?: string

  /** Class on the outer `.meowdown` wrapper div. */
  wrapperClassName?: string

  /** Imperative handle for the editor. */
  handleRef?: Ref<EditorHandle>

  /** Nodes rendered inside the editor's ProseKit context. */
  children?: ReactNode
}

export function MeowdownEditor({
  mode = 'focus',
  initialMarkdown,
  onDocChange,
  onSlashMenuSearch,
  onTagSearch,
  onWikilinkSearch,
  onSelectionMenuSearch,
  selectionMenuAffordance = true,
  pendingReplacementActions,
  onPendingReplacementResolve,
  onWikilinkClick,
  onLinkClick,
  onLinkCopy,
  onTagClick,
  onExitBoundary,
  resolveImageUrl,
  resolveFileLink,
  resolveWikiEmbed,
  resolveFileInfo,
  onFileClick,
  onFilePaste,
  onFileSaveError,
  onImageClick,
  embedPaste = true,
  linkPaste = true,
  bulletAfterHeading = false,
  substitution = true,
  frontmatter = false,
  blockHandle = true,
  placeholder,
  readOnly,
  spellCheck,
  timeFormat,
  editorClassName,
  wrapperClassName,
  handleRef,
  children,
}: EditorProps) {
  // Handle of the mounted editor.
  const childRef = useRef<EditorHandle>(null)

  useImperativeHandle(handleRef, () => {
    function getMarkdown(): string {
      return childRef.current?.getMarkdown() ?? ''
    }
    function setMarkdown(markdown: string): void {
      childRef.current?.setMarkdown(markdown)
    }
    function insertMarkdown(markdown: string): void {
      childRef.current?.insertMarkdown(markdown)
    }
    function getState(): EditorStateSnapshot {
      return childRef.current?.getState() ?? ['', { type: 'text', anchor: 0, head: 0 }]
    }
    function setState(markdown?: string, selection?: SelectionHint): void {
      childRef.current?.setState(markdown, selection)
    }
    function refreshMarkdownRendering(): void {
      childRef.current?.refreshMarkdownRendering()
    }
    function getSelection(): SelectionJSON {
      return childRef.current?.getSelection() ?? { type: 'text', anchor: 0, head: 0 }
    }
    function setSelection(selection: SelectionHint): void {
      childRef.current?.setSelection(selection)
    }
    function focus(): void {
      childRef.current?.focus()
    }
    function scrollIntoView(): void {
      childRef.current?.scrollIntoView()
    }
    function revealHeading(fragment: string): boolean {
      return childRef.current?.revealHeading(fragment) ?? false
    }
    function getSelectedText(): string {
      return childRef.current?.getSelectedText() ?? ''
    }
    function openSelectionMenu(): void {
      childRef.current?.openSelectionMenu()
    }
    function startPendingReplacement(options: StartPendingReplacementOptions): boolean {
      return childRef.current?.startPendingReplacement(options) ?? false
    }
    function appendPendingReplacementText(text: string): void {
      childRef.current?.appendPendingReplacementText(text)
    }
    function acceptPendingReplacement(options?: AcceptPendingReplacementOptions): void {
      childRef.current?.acceptPendingReplacement(options)
    }
    function discardPendingReplacement(): void {
      childRef.current?.discardPendingReplacement()
    }
    return {
      getMarkdown,
      setMarkdown,
      insertMarkdown,
      getState,
      setState,
      refreshMarkdownRendering,
      getSelection,
      setSelection,
      focus,
      scrollIntoView,
      revealHeading,
      getSelectedText,
      openSelectionMenu,
      startPendingReplacement,
      appendPendingReplacementText,
      acceptPendingReplacement,
      discardPendingReplacement,
      get editor() {
        return childRef.current?.editor
      },
    }
  }, [])

  return (
    <div className={clsx('meowdown', wrapperClassName)}>
      <ProseKitEditor
        ref={childRef}
        markMode={mode}
        initialMarkdown={initialMarkdown}
        onDocChange={onDocChange}
        onSlashMenuSearch={onSlashMenuSearch}
        onTagSearch={onTagSearch}
        onWikilinkSearch={onWikilinkSearch}
        onSelectionMenuSearch={onSelectionMenuSearch}
        selectionMenuAffordance={selectionMenuAffordance}
        pendingReplacementActions={pendingReplacementActions}
        onPendingReplacementResolve={onPendingReplacementResolve}
        onWikilinkClick={onWikilinkClick}
        onLinkClick={onLinkClick}
        onLinkCopy={onLinkCopy}
        onTagClick={onTagClick}
        onExitBoundary={onExitBoundary}
        resolveImageUrl={resolveImageUrl}
        resolveFileLink={resolveFileLink}
        resolveWikiEmbed={resolveWikiEmbed}
        resolveFileInfo={resolveFileInfo}
        onFileClick={onFileClick}
        onFilePaste={onFilePaste}
        onFileSaveError={onFileSaveError}
        onImageClick={onImageClick}
        embedPaste={embedPaste}
        linkPaste={linkPaste}
        bulletAfterHeading={bulletAfterHeading}
        substitution={substitution}
        frontmatter={frontmatter}
        blockHandle={blockHandle}
        placeholder={placeholder}
        readOnly={readOnly}
        spellCheck={spellCheck}
        timeFormat={timeFormat}
        editorClassName={editorClassName}
      >
        {children}
      </ProseKitEditor>
    </div>
  )
}
