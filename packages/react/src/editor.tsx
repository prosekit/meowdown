import {
  defineEditorExtension,
  defineMarkMode,
  type TypedEditor,
  type EditorExtension,
  type MarkMode,
} from '@meowdown/core'
import { createEditor, defineDocChangeHandler } from '@prosekit/core'
import { ProseKit, useExtension } from '@prosekit/react'
import { useMemo, useState } from 'react'

export interface EditorProps {
  markMode?: MarkMode

  /**
   * The initial content of the editor, as an HTML string. Only the value provided on
   * the first render is used; later changes are ignored.
   */
  defaultContent?: string

  /**
   * A callback function that is called whenever the content of the editor changes. This function should be memoized.
   */
  onChange?: (editor: TypedEditor) => void
}

export function Editor({
  markMode = 'focus',
  defaultContent = '<p>Hello World!</p>',
  onChange,
}: EditorProps) {
  const [editor] = useState((): TypedEditor => {
    const extension: EditorExtension = defineEditorExtension()
    return createEditor({ extension, defaultContent })
  })

  const markModeExtension = useMemo(() => {
    return defineMarkMode(markMode)
  }, [markMode])

  const docChangeExtension = useMemo(() => {
    if (!onChange) return null
    return defineDocChangeHandler(() => {
      onChange(editor)
    })
  }, [onChange, editor])

  useExtension(markModeExtension, { editor })
  useExtension(docChangeExtension, { editor })

  return (
    <ProseKit editor={editor}>
      <div ref={editor.mount}></div>
    </ProseKit>
  )
}
