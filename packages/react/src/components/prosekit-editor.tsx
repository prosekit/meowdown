import {
  defineEditorExtension,
  defineMarkMode,
  type TypedEditor,
  type EditorExtension,
  type MarkMode,
  docToMarkdown,
  markdownToDoc,
} from '@meowdown/core'
import { createEditor, defineDocChangeHandler } from '@prosekit/core'
import { ProseKit, useExtension } from '@prosekit/react'
import { useImperativeHandle, useMemo, useState, type Ref } from 'react'

import { SlashMenu } from './slash-menu.tsx'
import { TagMenu } from './tag-menu.tsx'
import type { EditorHandle, TagSearchHandler } from './types.ts'

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

  /** Imperative handle for the editor. */
  ref?: Ref<EditorHandle>
}

export function ProseKitEditor({
  markMode = 'focus',
  initialMarkdown,
  onDocChange,
  onTagSearch,
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
    return { getMarkdown: () => docToMarkdown(editor.state.doc) }
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
      <div ref={editor.mount}></div>
      <SlashMenu />
      {onTagSearch && <TagMenu onTagSearch={onTagSearch} />}
    </ProseKit>
  )
}
