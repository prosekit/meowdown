import {
  defineEditorExtension,
  defineImageExtension,
  defaultResolveImageUrl,
  defineMarkMode,
  type TypedEditor,
  type MarkMode,
  docToMarkdown,
  markdownToDoc,
} from '@meowdown/core'
import { clamp } from '@ocavue/utils'
import { createEditor, defineDocChangeHandler, union, type SelectionJSON } from '@prosekit/core'
import type { EditorNode } from '@prosekit/pm/model'
import { Selection, TextSelection } from '@prosekit/pm/state'
import { ProseKit, useExtension } from '@prosekit/react'
import { useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'

import { defineCodeBlockView } from '../extensions/code-block-view.ts'

import { BlockHandle } from './block-handle.tsx'
import { DropIndicator } from './drop-indicator.tsx'
import { SlashMenu } from './slash-menu.tsx'
import { TagMenu } from './tag-menu.tsx'
import type {
  EditorHandle,
  EditorStateSnapshot,
  ImageUploadErrorHandler,
  ImageUploadHandler,
  ImageUploadPredicate,
  ImageUrlResolver,
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

  /** Called on every document change. */
  onDocChange?: VoidFunction

  /** Enables the tag menu. See `EditorProps.onTagSearch`. */
  onTagSearch?: TagSearchHandler

  /** Enables the wikilink menu. See `EditorProps.onWikilinkSearch`. */
  onWikilinkSearch?: WikilinkSearchHandler

  /** Maps a Markdown image src to a displayable URL. See `EditorProps.resolveImageUrl`. */
  resolveImageUrl?: ImageUrlResolver

  /** Enables image paste/drop upload. See `EditorProps.onImageUpload`. */
  onImageUpload?: ImageUploadHandler

  /** Decides which files to upload. See `EditorProps.canUploadImage`. */
  canUploadImage?: ImageUploadPredicate

  /** Reports an upload failure. See `EditorProps.onImageUploadError`. */
  onImageUploadError?: ImageUploadErrorHandler

  /** Enables or disables spell checking in the editor. */
  spellCheck?: boolean

  /** Imperative handle for the editor. */
  ref?: Ref<EditorHandle>
}

export function ProseKitEditor({
  markMode = 'focus',
  initialMarkdown,
  onDocChange,
  onTagSearch,
  onWikilinkSearch,
  resolveImageUrl,
  onImageUpload,
  canUploadImage,
  onImageUploadError,
  spellCheck,
  ref,
}: ProseKitEditorProps) {
  // The latest handler closures are read at call time so a re-render with a
  // new closure never strands the extension calling a stale one. Whether
  // upload is enabled, though, is decided once, on the first render.
  const imageHandlersRef = useRef({
    resolveImageUrl,
    onImageUpload,
    canUploadImage,
    onImageUploadError,
  })
  imageHandlersRef.current = { resolveImageUrl, onImageUpload, canUploadImage, onImageUploadError }

  const [editor] = useState((): TypedEditor => {
    // The image extension installs file paste/drop handlers, which must be
    // present at creation (they don't compose cleanly through a later
    // `editor.use`), so it is unioned with the base here.
    //
    // REVIEW: I DO NOT UNDERSTAND "they don't compose cleanly through a later `editor.use`". Try to explain this better with very detailed information and
    // add comment here. Notice that we do not have to follow "Whether upload is enabled, though, is decided once, on the first render.". We can just assue
    // that whoever use the editor will always provide the upload functions (so that the editor can actually work).
    const imageExtension = defineImageExtension({
      resolveUrl: (src) =>
        (imageHandlersRef.current.resolveImageUrl ?? defaultResolveImageUrl)(src),
      upload: onImageUpload
        ? (file) => (imageHandlersRef.current.onImageUpload ?? onImageUpload)(file)
        : undefined,
      canUpload: canUploadImage
        ? (file) => (imageHandlersRef.current.canUploadImage ?? canUploadImage)(file)
        : undefined,
      onUploadError: ({ error, file }) => {
        const handler = imageHandlersRef.current.onImageUploadError
        if (handler) handler({ error, file })
        else console.error(error)
      },
    })
    const editor = createEditor({
      extension: union(defineEditorExtension(), imageExtension, defineCodeBlockView()),
    }) as TypedEditor
    if (initialMarkdown) {
      editor.setContent(markdownToDoc(editor, initialMarkdown))
    }
    return editor
  })

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
        const doc = markdownToDoc(editor, markdown)
        transaction.replaceWith(0, transaction.doc.content.size, doc.content)
      }
      if (selection) {
        transaction.setSelection(resolveSelection(transaction.doc, selection)).scrollIntoView()
      }
      editor.view.dispatch(transaction)
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
    }
  }, [editor])

  const markModeExtension = useMemo(() => {
    return defineMarkMode(markMode)
  }, [markMode])
  useExtension(markModeExtension, { editor })

  const docChangeExtension = useMemo(() => {
    if (!onDocChange) return null
    return defineDocChangeHandler(() => {
      onDocChange()
    })
  }, [onDocChange])
  useExtension(docChangeExtension, { editor })

  return (
    <ProseKit editor={editor}>
      <div ref={editor.mount} spellCheck={spellCheck}></div>
      <BlockHandle />
      <DropIndicator />
      <SlashMenu />
      {onTagSearch && <TagMenu onTagSearch={onTagSearch} />}
      {onWikilinkSearch && <WikilinkMenu onWikilinkSearch={onWikilinkSearch} />}
    </ProseKit>
  )
}
