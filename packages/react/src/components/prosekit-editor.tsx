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
  // Every image callback is read through this ref at call time, so a re-render
  // with a new closure (or newly added/removed handler) is picked up live: the
  // image extension is built once but never captures a stale closure.
  const imageHandlersRef = useRef({
    resolveImageUrl,
    onImageUpload,
    canUploadImage,
    onImageUploadError,
  })
  imageHandlersRef.current = { resolveImageUrl, onImageUpload, canUploadImage, onImageUploadError }

  const [editor] = useState((): TypedEditor => {
    // The image extension is unioned with the base here, at creation, instead of
    // being added later with `editor.use(...)`. The upload half registers its
    // paste/drop handlers through ProseKit's facet system (a child facet of
    // `editorEventFacet`). Each facet is assigned a fixed numeric path, and when
    // `editor.use` folds a new extension into an already-built editor it merges
    // the two facet trees position-by-position (`unionFacetNode`), asserting
    // that both sides at a given path point to the same facet. A facet defined
    // in a separately-loaded module (`@prosekit/extensions/file`) can land on a
    // path that collides with another facet in the live tree, tripping that
    // assertion and throwing at runtime. Composing the whole tree once, before
    // the editor exists, sidesteps the incremental merge so the handlers always
    // install cleanly.
    //
    // The handlers are always installed; `canUpload` is what actually gates
    // uploading, returning false (so paste/drop falls back to the default) while
    // no `onImageUpload` is set. Reading it from the ref keeps enablement live
    // rather than frozen at first render.
    const imageExtension = defineImageExtension({
      resolveUrl: (src) =>
        (imageHandlersRef.current.resolveImageUrl ?? defaultResolveImageUrl)(src),
      upload: (file) => {
        const handler = imageHandlersRef.current.onImageUpload
        return handler ? handler(file) : Promise.reject(new Error('onImageUpload is not set'))
      },
      canUpload: (file) => {
        if (!imageHandlersRef.current.onImageUpload) return false
        const predicate = imageHandlersRef.current.canUploadImage
        return predicate ? predicate(file) : file.type.startsWith('image/')
      },
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
