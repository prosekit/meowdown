import {
  defineEditorExtension,
  docToMarkdown,
  markdownToDoc,
  type EditorExtension,
  type ExitBoundaryHandler,
  type ImageClickHandler,
  type ImageOptions,
  type LinkClickHandler,
  type LinkCopyHandler,
  type MarkMode,
  type PlaceholderOptions,
  type TagClickHandler,
  type TypedEditor,
  type WikilinkClickHandler,
} from '@meowdown/core'
import { clamp } from '@ocavue/utils'
import { createEditor, union, type SelectionJSON } from '@prosekit/core'
import type { EditorNode } from '@prosekit/pm/model'
import { Selection, TextSelection } from '@prosekit/pm/state'
import { ProseKit } from '@prosekit/react'
import { clsx } from 'clsx/lite'
import { useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'

import { defineCodeBlockView } from '../extensions/code-block-view.ts'
import type { TimeFormat } from '../utils/date-format.ts'

import { BlockHandle } from './block-handle.tsx'
import { DropIndicator } from './drop-indicator.tsx'
import { EditorExtensions } from './editor-extensions.tsx'
import { LinkMenu } from './link-menu.tsx'
import { SlashMenu } from './slash-menu.tsx'
import { TableHandle } from './table-handle.tsx'
import { TagMenu } from './tag-menu.tsx'
import type {
  EditorHandle,
  EditorStateSnapshot,
  SelectionHint,
  SlashMenuSearchHandler,
  TagSearchHandler,
  WikilinkSearchHandler,
} from './types.ts'
import { WikilinkMenu } from './wikilink-menu.tsx'

// Selections coming through `setState` are hints: restore them exactly when
// possible, otherwise clamp to the nearest valid text selection.
function resolveSelection(doc: EditorNode, selection: SelectionHint): Selection {
  if (selection === 'start') return Selection.atStart(doc)
  if (selection === 'end') return Selection.atEnd(doc)
  try {
    return Selection.fromJSON(doc, selection)
  } catch {
    const size = doc.content.size
    // Node and all selections serialize without a head.
    const anchor = clamp(selection.anchor ?? 0, 0, size)
    const head = clamp(selection.head ?? anchor, 0, size)
    return TextSelection.between(doc.resolve(anchor), doc.resolve(head))
  }
}

export interface ProseKitEditorProps {
  markMode?: MarkMode

  /**
   * The initial Markdown text of the editor. Only the value provided on the
   * first render is used; later changes are ignored.
   */
  initialMarkdown?: string

  /** Called on every user-driven document change, not on programmatic setState. */
  onDocChange?: VoidFunction

  /** Adds host items to the slash menu. See `EditorProps.onSlashMenuSearch`. */
  onSlashMenuSearch?: SlashMenuSearchHandler

  /** Enables the tag menu. See `EditorProps.onTagSearch`. */
  onTagSearch?: TagSearchHandler

  /** Enables the wikilink menu. See `EditorProps.onWikilinkSearch`. */
  onWikilinkSearch?: WikilinkSearchHandler

  /** Called on click of a rendered wiki link. See `EditorProps.onWikilinkClick`. */
  onWikilinkClick?: WikilinkClickHandler

  /** Called on click of a rendered Markdown link. See `EditorProps.onLinkClick`. */
  onLinkClick?: LinkClickHandler

  /** Called after a link is copied from the link menu. See `EditorProps.onLinkCopy`. */
  onLinkCopy?: LinkCopyHandler

  /** Called on click of a rendered tag. See `EditorProps.onTagClick`. */
  onTagClick?: TagClickHandler

  /** Called when an arrow press leaves the document boundary. See `EditorProps.onExitBoundary`. */
  onExitBoundary?: ExitBoundaryHandler

  /** Resolves an image `src` to a URL. See `EditorProps.resolveImageUrl`. */
  resolveImageUrl?: ImageOptions['resolveImageUrl']

  /** Persists a pasted/dropped image. See `EditorProps.onImagePaste`. */
  onImagePaste?: ImageOptions['onImagePaste']

  /** Persists a pasted/dropped non-image file. See `EditorProps.onFilePaste`. */
  onFilePaste?: ImageOptions['onFilePaste']

  /** Called when a pasted/dropped file fails to persist. See `EditorProps.onImageSaveError`. */
  onImageSaveError?: ImageOptions['onImageSaveError']

  /** Called on click of a rendered image. See `EditorProps.onImageClick`. */
  onImageClick?: ImageClickHandler

  /** Auto-embeds a pasted tweet/YouTube link. See `EditorProps.embedPaste`. */
  embedPaste?: boolean

  /** Starts a bullet on Enter after a heading. See `EditorProps.bulletAfterHeading`. */
  bulletAfterHeading?: boolean

  /** Handles a leading YAML frontmatter block. See `EditorProps.frontmatter`. */
  frontmatter?: boolean

  /** Shows the per-block gutter handle. See `EditorProps.blockHandle`. */
  blockHandle?: boolean

  /** Placeholder text for empty blocks. See `EditorProps.placeholder`. */
  placeholder?: PlaceholderOptions['placeholder']

  /** Makes the editor read-only. See `EditorProps.readOnly`. */
  readOnly?: boolean

  /** Enables or disables spell checking in the editor. */
  spellCheck?: boolean

  /** Clock format the `/now` slash command inserts. See `EditorProps.timeFormat`. */
  timeFormat?: TimeFormat

  /** Class on the editable root. See `EditorProps.editorClassName`. */
  editorClassName?: string

  /** Imperative handle for the editor. */
  ref?: Ref<EditorHandle>

  /** Nodes rendered inside the ProseKit context. See `EditorProps.children`. */
  children?: ReactNode
}

export function ProseKitEditor({
  markMode = 'focus',
  initialMarkdown,
  onDocChange,
  onSlashMenuSearch,
  onTagSearch,
  onWikilinkSearch,
  onWikilinkClick,
  onLinkClick,
  onLinkCopy,
  onTagClick,
  onExitBoundary,
  resolveImageUrl,
  onImagePaste,
  onFilePaste,
  onImageSaveError,
  onImageClick,
  embedPaste,
  bulletAfterHeading,
  frontmatter = false,
  blockHandle = true,
  placeholder,
  readOnly,
  spellCheck,
  timeFormat,
  editorClassName,
  ref,
  children,
}: ProseKitEditorProps) {
  const [editor] = useState((): TypedEditor => {
    const baseExtension: EditorExtension = defineEditorExtension()
    const extension = union(baseExtension, defineCodeBlockView())
    const editor: TypedEditor = createEditor({ extension })
    if (initialMarkdown) {
      editor.setContent(markdownToDoc(initialMarkdown, { nodes: editor.nodes, frontmatter }))
    }
    return editor
  })

  // Set while a programmatic setState/setMarkdown dispatch runs, so the
  // doc-change handler can ignore it: a host replacing content already knows.
  const suppressDocChangeRef = useRef(false)

  useImperativeHandle(ref, () => {
    function getMarkdown(): string {
      return docToMarkdown(editor.state.doc, { frontmatter })
    }
    function getSelection(): SelectionJSON {
      return editor.state.selection.toJSON() as SelectionJSON
    }
    function getState(): EditorStateSnapshot {
      return [getMarkdown(), getSelection()]
    }
    function setState(markdown?: string, selection?: SelectionHint): void {
      if (markdown == null && !selection) return
      const transaction = editor.state.tr
      if (markdown != null) {
        const doc = markdownToDoc(markdown, { nodes: editor.nodes, frontmatter })
        transaction.replaceWith(0, transaction.doc.content.size, doc.content)
      }
      if (selection) {
        transaction.setSelection(resolveSelection(transaction.doc, selection)).scrollIntoView()
      }
      suppressDocChangeRef.current = true
      try {
        editor.view.dispatch(transaction)
      } finally {
        suppressDocChangeRef.current = false
      }
    }
    function setMarkdown(markdown: string): void {
      setState(markdown)
    }
    function insertMarkdown(markdown: string): void {
      editor.commands.insertMarkdown(markdown)
    }
    function setSelection(selection: SelectionHint): void {
      setState(undefined, selection)
    }
    function focus(): void {
      editor.focus()
    }
    function scrollIntoView(): void {
      editor.view.dispatch(editor.state.tr.scrollIntoView())
    }
    return {
      getMarkdown,
      setMarkdown,
      insertMarkdown,
      getState,
      setState,
      getSelection,
      setSelection,
      focus,
      scrollIntoView,
      editor,
    }
  }, [editor, frontmatter])

  // Guard the host callback so programmatic setState/setMarkdown stays silent.
  // Stable per `onDocChange` identity, so the extension is not rebuilt every render.
  const handleDocChange = useMemo(() => {
    if (!onDocChange) return
    return () => {
      if (suppressDocChangeRef.current) return
      onDocChange()
    }
  }, [onDocChange])

  return (
    <ProseKit editor={editor}>
      <div ref={editor.mount} className={clsx('meowdown-content', editorClassName)}></div>
      <EditorExtensions
        markMode={markMode}
        onDocChange={handleDocChange}
        onWikilinkClick={onWikilinkClick}
        onLinkClick={onLinkClick}
        onTagClick={onTagClick}
        onExitBoundary={onExitBoundary}
        resolveImageUrl={resolveImageUrl}
        onImagePaste={onImagePaste}
        onFilePaste={onFilePaste}
        onImageSaveError={onImageSaveError}
        onImageClick={onImageClick}
        embedPaste={embedPaste}
        bulletAfterHeading={bulletAfterHeading}
        placeholder={placeholder}
        readOnly={readOnly}
        wikilinkEnabled={!!onWikilinkSearch}
        spellCheck={spellCheck}
      />
      {blockHandle && !readOnly && <BlockHandle />}
      {!readOnly && <TableHandle />}
      {blockHandle && !readOnly && <DropIndicator />}
      <SlashMenu timeFormat={timeFormat} onSlashMenuSearch={onSlashMenuSearch} />
      {!readOnly && <LinkMenu onLinkClick={onLinkClick} onLinkCopy={onLinkCopy} />}
      {onTagSearch && <TagMenu onTagSearch={onTagSearch} />}
      {onWikilinkSearch && <WikilinkMenu onWikilinkSearch={onWikilinkSearch} />}
      {children}
    </ProseKit>
  )
}
