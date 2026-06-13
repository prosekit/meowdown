import {
  defineEditorExtension,
  defineMarkMode,
  type TypedEditor,
  type EditorExtension,
  type MarkMode,
  docToMarkdown,
  markdownToDoc,
} from '@meowdown/core'
import { clamp } from '@ocavue/utils'
import { createEditor, defineDocChangeHandler, type SelectionJSON } from '@prosekit/core'
import type { EditorNode } from '@prosekit/pm/model'
import { Selection, TextSelection } from '@prosekit/pm/state'
import { ProseKit, useExtension } from '@prosekit/react'
import { useImperativeHandle, useMemo, useState, type Ref } from 'react'

import { BlockHandle } from './block-handle.tsx'
import { defineCodeBlockView } from './code-block-view.tsx'
import { DropIndicator } from './drop-indicator.tsx'
import { SlashMenu } from './slash-menu.tsx'
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

  /** Called on every document change. */
  onDocChange?: VoidFunction

  /** Enables the tag menu. See `EditorProps.onTagSearch`. */
  onTagSearch?: TagSearchHandler

  /** Enables the wikilink menu. See `EditorProps.onWikilinkSearch`. */
  onWikilinkSearch?: WikilinkSearchHandler

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
  spellCheck,
  ref,
}: ProseKitEditorProps) {
  const [editor] = useState((): TypedEditor => {
    const extension: EditorExtension = defineEditorExtension()
    const editor: TypedEditor = createEditor({ extension })
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

  const [codeBlockViewExtension] = useState(defineCodeBlockView)
  useExtension(codeBlockViewExtension, { editor })

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
