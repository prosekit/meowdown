import type { MarkMode } from '@meowdown/core'
import { useCallback, useRef } from 'react'

import { CodeMirrorEditor } from './codemirror-editor.tsx'
import { ProseKitEditor } from './prosekit-editor.tsx'
import type { ChangeHandlerOptions } from './types.ts'

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
   * The initial content of the editor, as a Markdown string. Only the value provided on
   * the first render is used; later changes are ignored.
   */
  initialContent?: string

  /**
   * A callback function that is called whenever the content of the editor changes. This function should be memoized.
   */
  onChange?: (options: ChangeHandlerOptions) => void
}

export function Editor({ mode = 'focus', initialContent, onChange }: EditorProps) {
  // Latest markdown, kept up to date on every change from whichever editor
  // is mounted. Used to seed the other editor when the mode family flips.
  const contentRef = useRef(initialContent ?? '')

  const handleChange = useCallback(
    (options: ChangeHandlerOptions) => {
      contentRef.current = options.getMarkdown()
      onChange?.(options)
    },
    [onChange],
  )

  if (mode === 'source') {
    return <CodeMirrorEditor initialContent={contentRef.current} onChange={handleChange} />
  }
  return (
    <ProseKitEditor markMode={mode} initialContent={contentRef.current} onChange={handleChange} />
  )
}
