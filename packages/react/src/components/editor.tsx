import type { MarkMode } from '@meowdown/core'
import { useImperativeHandle, useRef, type Ref } from 'react'

import { CodeMirrorEditor } from './codemirror-editor.tsx'
import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

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
   * The initial Markdown text of the editor. Only the value provided on the
   * first render is used; later changes are ignored.
   */
  initialMarkdown?: string

  /** Called on every document change. */
  onDocChange?: VoidFunction

  /** Imperative handle for the editor. */
  ref?: Ref<EditorHandle>
}

export function Editor({ mode = 'focus', initialMarkdown, onDocChange, ref }: EditorProps) {
  // Handle of whichever editor is currently mounted.
  const childRef = useRef<EditorHandle>(null)

  useImperativeHandle(ref, () => {
    return { getMarkdown: () => childRef.current?.getMarkdown() ?? '' }
  }, [])

  // Seed for the mounted editor: the initial markdown on the first render,
  // the previous editor's content when the mode family flips.
  const seedMarkdown = childRef.current?.getMarkdown() ?? initialMarkdown ?? ''

  if (mode === 'source') {
    return (
      <CodeMirrorEditor ref={childRef} initialMarkdown={seedMarkdown} onDocChange={onDocChange} />
    )
  } else {
    return (
      <ProseKitEditor
        ref={childRef}
        markMode={mode}
        initialMarkdown={seedMarkdown}
        onDocChange={onDocChange}
      />
    )
  }
}
