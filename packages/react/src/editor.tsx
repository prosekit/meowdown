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

export interface ChangeHandlerOptions {
  editor: TypedEditor
  getMarkdown: () => string
}

export interface EditorProps {
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

export function Editor({ markMode = 'focus', initialContent, onChange }: EditorProps) {
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

    return { editor, getMarkdown }
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
