import {
  MeowdownEditor,
  type EditorHandle,
  type EditorMode,
  type EditorProps,
} from '@meowdown/react'
import { useRef, type RefObject } from 'react'

import { CodeMirrorEditor } from './codemirror-editor.tsx'

/** The four demo modes: the three rich modes plus the CodeMirror source mode. */
export type DemoMode = EditorMode | 'source'

export interface DemoEditorProps extends Omit<EditorProps, 'mode' | 'handleRef'> {
  /**
   * The editor mode. 'source' renders a CodeMirror editor showing the raw
   * Markdown text; the three rich modes render the Meowdown editor. Defaults to
   * 'focus'.
   */
  mode?: DemoMode

  /**
   * Handle of whichever editor is currently mounted. In source mode the
   * selection and pending-replacement methods are no-ops.
   */
  handleRef?: RefObject<EditorHandle | null>
}

export function DemoEditor({
  mode = 'focus',
  initialMarkdown,
  onDocChange,
  readOnly,
  children,
  handleRef,
  ...richProps
}: DemoEditorProps) {
  // Handle of whichever editor is currently mounted. Reading it during render
  // seeds the next editor with the previous one's content when the mode flips
  // between the rich and source families.
  const fallbackRef = useRef<EditorHandle>(null)
  const childRef = handleRef ?? fallbackRef
  const seedMarkdown = childRef.current?.getMarkdown() ?? initialMarkdown ?? ''

  if (mode === 'source') {
    return (
      <div className="meowdown">
        <CodeMirrorEditor
          ref={childRef}
          initialMarkdown={seedMarkdown}
          onDocChange={onDocChange}
          readOnly={readOnly}
        />
      </div>
    )
  }

  return (
    <MeowdownEditor
      handleRef={childRef}
      mode={mode}
      initialMarkdown={seedMarkdown}
      onDocChange={onDocChange}
      readOnly={readOnly}
      {...richProps}
    >
      {children}
    </MeowdownEditor>
  )
}
