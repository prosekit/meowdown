import type {
  ImageClickHandler,
  ImageOptions,
  LinkClickHandler,
  MarkMode,
  PlaceholderOptions,
  TagClickHandler,
  WikilinkClickHandler,
} from '@meowdown/core'
import type { SelectionJSON } from '@prosekit/core'
import { clsx } from 'clsx/lite'
import { useImperativeHandle, useRef, type ReactNode, type Ref } from 'react'

import { CodeMirrorEditor } from './codemirror-editor.tsx'
import { ProseKitEditor } from './prosekit-editor.tsx'
import type {
  EditorHandle,
  EditorStateSnapshot,
  SelectionHint,
  TagSearchHandler,
  WikilinkSearchHandler,
} from './types.ts'

export type EditorMode = MarkMode | 'source'

export interface EditorProps {
  /**
   * The editor mode. The three rich modes ('focus', 'show', 'hide') render a ProseKit
   * editor; 'source' renders a CodeMirror editor showing the raw Markdown text.
   * Content carries over when switching between the two editor families, but undo
   * history and selection do not. Defaults to 'focus'.
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
   * Searches tags for the tag menu, which opens when typing `#` followed by
   * text in a rich mode. Receives the query (lowercased, punctuation
   * stripped) and returns the tags to show, synchronously or as a promise.
   * Pass a stable function (e.g. from `useCallback`). Omit to disable the
   * tag menu. Ignored in source mode.
   */
  onTagSearch?: TagSearchHandler

  /**
   * Searches notes for the wikilink menu, which opens as soon as `[[` or `@`
   * is typed in a rich mode. Receives the query (lowercased, punctuation
   * stripped, may be empty) and returns the note names to show,
   * synchronously or as a promise. Pass a stable function (e.g. from
   * `useCallback`). Omit to disable the wikilink menu. Ignored in source
   * mode.
   */
  onWikilinkSearch?: WikilinkSearchHandler

  /**
   * Called with the link target on click of a rendered wiki link. Pass a stable
   * function (e.g. from `useCallback`). Ignored in source mode.
   */
  onWikilinkClick?: WikilinkClickHandler

  /**
   * Called with the link `href` on click of a rendered Markdown link
   * (`[text](url)`). A plain click inside a link the caret already sits in just
   * places the caret; `Mod`-click always fires. Pass a stable function (e.g.
   * from `useCallback`). Ignored in source mode.
   */
  onLinkClick?: LinkClickHandler

  /**
   * Called with the tag name (without the leading `#`) on click of a rendered
   * `#tag`. A plain click inside a tag the caret already sits in just places the
   * caret; `Mod`-click always fires. Pass a stable function (e.g. from
   * `useCallback`). Ignored in source mode.
   */
  onTagClick?: TagClickHandler

  /**
   * Maps an image `src` to a displayable URL, or `undefined` to skip that image.
   * Defaults to showing http(s) URLs as-is. Pass a stable function (e.g. from
   * `useCallback`). Ignored in source mode.
   */
  resolveImageUrl?: ImageOptions['resolveImageUrl']

  /**
   * Persists a pasted/dropped image file and returns its markdown `src`. Pass a
   * stable function. Ignored in source mode.
   */
  onImagePaste?: ImageOptions['onImagePaste']

  /** Called when persisting a pasted/dropped image throws. Ignored in source mode. */
  onImageSaveError?: ImageOptions['onImageSaveError']

  /**
   * Called when the user clicks a rendered image, with its markdown `src`,
   * `alt`, and the originating `MouseEvent`. Pass a stable function (e.g. from
   * `useCallback`). Ignored in source mode.
   */
  onImageClick?: ImageClickHandler

  /**
   * Auto-embeds a pasted tweet or YouTube link as a rich embed; one undo turns
   * the embed back into the raw link. On by default. Ignored in source mode.
   */
  embedPaste?: boolean

  /**
   * Pressing Enter at the end of the document's first heading (the title line)
   * starts a fresh empty bullet on the next line instead of a plain paragraph.
   * Off by default. Ignored in source mode.
   */
  bulletAfterHeading?: boolean

  /** Handles a leading `---` frontmatter block in the rich modes (off by default, ignored in source mode). */
  frontmatter?: boolean

  /**
   * Shows the per-block gutter handle in the rich modes: a drag grip for
   * reordering blocks and a "+" add button, plus the drop indicator that
   * visualizes where a dragged block will land. On by default. Set to `false`
   * to hide the gutter affordance entirely, e.g. when the host does not want
   * block reordering. Ignored in source mode and when `readOnly` is set.
   */
  blockHandle?: boolean

  /**
   * Placeholder text shown when the whole document is empty. A function
   * receives the editor state. Pass a stable function. Ignored in source mode.
   */
  placeholder?: PlaceholderOptions['placeholder']

  /** Makes the editor read-only, in both the rich and source modes. */
  readOnly?: boolean

  /**
   * Enables the browser's native spell checking in the rich modes. Defaults
   * to the browser's behavior. Ignored in source mode.
   */
  spellCheck?: boolean

  /** Class on the editable root (the contenteditable). Rich modes only. */
  editorClassName?: string

  /** Class on the outer `.meowdown` wrapper div. */
  wrapperClassName?: string

  /** Imperative handle for the editor. */
  handleRef?: Ref<EditorHandle>

  /** Nodes rendered inside the editor's ProseKit context (rich modes only). */
  children?: ReactNode
}

export function MeowdownEditor({
  mode = 'focus',
  initialMarkdown,
  onDocChange,
  onTagSearch,
  onWikilinkSearch,
  onWikilinkClick,
  onLinkClick,
  onTagClick,
  resolveImageUrl,
  onImagePaste,
  onImageSaveError,
  onImageClick,
  embedPaste = true,
  bulletAfterHeading = false,
  frontmatter = false,
  blockHandle = true,
  placeholder,
  readOnly,
  spellCheck,
  editorClassName,
  wrapperClassName,
  handleRef,
  children,
}: EditorProps) {
  // Handle of whichever editor is currently mounted.
  const childRef = useRef<EditorHandle>(null)

  useImperativeHandle(handleRef, () => {
    function getMarkdown(): string {
      return childRef.current?.getMarkdown() ?? ''
    }
    function setMarkdown(markdown: string): void {
      childRef.current?.setMarkdown(markdown)
    }
    function getState(): EditorStateSnapshot {
      return childRef.current?.getState() ?? ['', { type: 'text', anchor: 0, head: 0 }]
    }
    function setState(markdown?: string, selection?: SelectionHint): void {
      childRef.current?.setState(markdown, selection)
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
    return {
      getMarkdown,
      setMarkdown,
      getState,
      setState,
      getSelection,
      setSelection,
      focus,
      scrollIntoView,
      get editor() {
        return childRef.current?.editor
      },
    }
  }, [])

  // Seed for the mounted editor: the initial markdown on the first render,
  // the previous editor's content when the mode family flips.
  const seedMarkdown = childRef.current?.getMarkdown() ?? initialMarkdown ?? ''

  return (
    <div className={clsx('meowdown', wrapperClassName)}>
      {mode === 'source' ? (
        <CodeMirrorEditor
          ref={childRef}
          initialMarkdown={seedMarkdown}
          onDocChange={onDocChange}
          readOnly={readOnly}
        />
      ) : (
        <ProseKitEditor
          ref={childRef}
          markMode={mode}
          initialMarkdown={seedMarkdown}
          onDocChange={onDocChange}
          onTagSearch={onTagSearch}
          onWikilinkSearch={onWikilinkSearch}
          onWikilinkClick={onWikilinkClick}
          onLinkClick={onLinkClick}
          onTagClick={onTagClick}
          resolveImageUrl={resolveImageUrl}
          onImagePaste={onImagePaste}
          onImageSaveError={onImageSaveError}
          onImageClick={onImageClick}
          embedPaste={embedPaste}
          bulletAfterHeading={bulletAfterHeading}
          frontmatter={frontmatter}
          blockHandle={blockHandle}
          placeholder={placeholder}
          readOnly={readOnly}
          spellCheck={spellCheck}
          editorClassName={editorClassName}
        >
          {children}
        </ProseKitEditor>
      )}
    </div>
  )
}
