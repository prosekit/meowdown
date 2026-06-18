import {
  defineEditorExtension,
  type TypedEditor,
  type EditorExtension,
  type ImageClickHandler,
  type ImageOptions,
  type MarkMode,
  type PlaceholderOptions,
  type WikilinkClickHandler,
  docToMarkdown,
  markdownToDoc,
} from '@meowdown/core'
import { clamp } from '@ocavue/utils'
import { createEditor, type SelectionJSON, union } from '@prosekit/core'
import type { EditorNode } from '@prosekit/pm/model'
import { Selection, TextSelection } from '@prosekit/pm/state'
import { ProseKit } from '@prosekit/react'
import { useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'

import { defineCodeBlockView } from '../extensions/code-block-view.ts'

import { BlockHandle } from './block-handle.tsx'
import { DropIndicator } from './drop-indicator.tsx'
import { EditorExtensions } from './editor-extensions.tsx'
import { SlashMenu } from './slash-menu.tsx'
import { TableHandle } from './table-handle.tsx'
import { TagMenu } from './tag-menu.tsx'
import type {
  EditorHandle,
  EditorStateSnapshot,
  SelectionHint,
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

  /** Enables the tag menu. See `EditorProps.onTagSearch`. */
  onTagSearch?: TagSearchHandler

  /** Enables the wikilink menu. See `EditorProps.onWikilinkSearch`. */
  onWikilinkSearch?: WikilinkSearchHandler

  /** Called on click of a rendered wiki link. See `EditorProps.onWikilinkClick`. */
  onWikilinkClick?: WikilinkClickHandler

  /** Resolves an image `src` to a URL. See `EditorProps.resolveImageUrl`. */
  resolveImageUrl?: ImageOptions['resolveImageUrl']

  /** Persists a pasted/dropped image. See `EditorProps.onImagePaste`. */
  onImagePaste?: ImageOptions['onImagePaste']

  /** Called when an image fails to persist. See `EditorProps.onImageSaveError`. */
  onImageSaveError?: ImageOptions['onImageSaveError']

  /** Called on click of a rendered image. See `EditorProps.onImageClick`. */
  onImageClick?: ImageClickHandler

  /** Auto-embeds a pasted tweet/YouTube link. See `EditorProps.embedPaste`. */
  embedPaste?: boolean

  /** Starts a bullet on Enter after a heading. See `EditorProps.bulletAfterHeading`. */
  bulletAfterHeading?: boolean

  /** Shows the per-block gutter handle. See `EditorProps.blockHandle`. */
  blockHandle?: boolean

  /** Placeholder text for empty blocks. See `EditorProps.placeholder`. */
  placeholder?: PlaceholderOptions['placeholder']

  /** Makes the editor read-only. See `EditorProps.readOnly`. */
  readOnly?: boolean

  /** Enables or disables spell checking in the editor. */
  spellCheck?: boolean

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
  onTagSearch,
  onWikilinkSearch,
  onWikilinkClick,
  resolveImageUrl,
  onImagePaste,
  onImageSaveError,
  onImageClick,
  embedPaste,
  bulletAfterHeading,
  blockHandle = true,
  placeholder,
  readOnly,
  spellCheck,
  editorClassName,
  ref,
  children,
}: ProseKitEditorProps) {
  const [editor] = useState((): TypedEditor => {
    const baseExtension: EditorExtension = defineEditorExtension()
    const extension = union(baseExtension, defineCodeBlockView())
    const editor: TypedEditor = createEditor({ extension })
    if (initialMarkdown) {
      editor.setContent(markdownToDoc(initialMarkdown, editor.nodes))
    }
    return editor
  })

  // Set while a programmatic setState/setMarkdown dispatch runs, so the
  // doc-change handler can ignore it: a host replacing content already knows.
  const suppressDocChangeRef = useRef(false)

  useImperativeHandle(ref, () => {
    function getMarkdown(): string {
      return docToMarkdown(editor.state.doc)
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
        const doc = markdownToDoc(markdown, editor.nodes)
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
      getState,
      setState,
      getSelection,
      setSelection,
      focus,
      scrollIntoView,
      editor,
    }
  }, [editor])

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
      <div ref={editor.mount} spellCheck={spellCheck} className={editorClassName}></div>
      <EditorExtensions
        markMode={markMode}
        onDocChange={handleDocChange}
        onWikilinkClick={onWikilinkClick}
        resolveImageUrl={resolveImageUrl}
        onImagePaste={onImagePaste}
        onImageSaveError={onImageSaveError}
        onImageClick={onImageClick}
        embedPaste={embedPaste}
        bulletAfterHeading={bulletAfterHeading}
        placeholder={placeholder}
        readOnly={readOnly}
      />
      {blockHandle && !readOnly && <BlockHandle />}
      {!readOnly && <TableHandle />}
      {blockHandle && !readOnly && <DropIndicator />}
      <SlashMenu />
      {onTagSearch && <TagMenu onTagSearch={onTagSearch} />}
      {onWikilinkSearch && <WikilinkMenu onWikilinkSearch={onWikilinkSearch} />}
      {children}
    </ProseKit>
  )
}
