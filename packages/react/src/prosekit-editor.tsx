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
import { useMemo, useState } from 'react'

import type { ChangeHandlerOptions } from './types.ts'

export interface ProseKitEditorProps {
  markMode?: MarkMode

  /**
   * The initial content of the editor, as a Markdown string. Only the value provided on
   * the first render is used; later changes are ignored.
   */
  initialContent?: string

  /**
   * A callback function that is called whenever the content of the editor changes. This function should be memoized.
   */
  onChange?: (options: ChangeHandlerOptions) => void
}

export function ProseKitEditor({
  markMode = 'focus',
  initialContent,
  onChange,
}: ProseKitEditorProps) {
  const [editor] = useState((): TypedEditor => {
    const extension: EditorExtension = defineEditorExtension()
    const editor: TypedEditor = createEditor({ extension })
    if (initialContent) {
      editor.setContent(markdownToDoc(editor, initialContent))
    }
    return editor
  })

  const markModeExtension = useMemo(() => {
    return defineMarkMode(markMode)
  }, [markMode])
  useExtension(markModeExtension, { editor })

  const changeOptions: ChangeHandlerOptions = useMemo(() => {
    const getMarkdown = (): string => {
      return docToMarkdown(editor.state.doc)
    }

    return { getMarkdown }
  }, [editor])

  const docChangeExtension = useMemo(() => {
    if (!onChange) return null

    return defineDocChangeHandler(() => {
      onChange(changeOptions)
    })
  }, [onChange, changeOptions])
  useExtension(docChangeExtension, { editor })

  return (
    <ProseKit editor={editor}>
      <div ref={editor.mount}></div>
    </ProseKit>
  )
}
