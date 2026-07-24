import {
  MeowdownEditor,
  type EditorHandle,
  type EditorMode,
  type EditorProps,
  type TaskClickHandler,
} from '@meowdown/react'
import { useCallback, useRef, type RefObject } from 'react'

import { CodeMirrorEditor } from './codemirror-editor.tsx'
import type { MarkdownSource } from './markdown-source.ts'
import { ReadonlyView } from './readonly-view.tsx'

/**
 * The five demo modes: the three rich modes, the CodeMirror source mode, and
 * the read-only `MarkdownView` mode.
 */
export type DemoMode = EditorMode | 'source' | 'readonly'

export interface DemoEditorProps extends Omit<EditorProps, 'mode' | 'handleRef'> {
  /**
   * The editor mode. 'source' renders a CodeMirror editor showing the raw
   * Markdown text, 'readonly' renders the document with `MarkdownView`; the
   * three rich modes render the Meowdown editor. Defaults to 'focus'.
   */
  mode?: DemoMode

  /**
   * Handle of the rich editor. Detached (null) in the source and readonly
   * modes, which support none of its methods.
   */
  handleRef?: RefObject<EditorHandle | null>
}

export function DemoEditor({
  mode = 'focus',
  initialMarkdown,
  children,
  handleRef,
  ...richProps
}: DemoEditorProps) {
  // Handles of whichever pane is currently mounted. Reading them during render
  // seeds the next pane with the previous one's content when the mode flips.
  const fallbackRef = useRef<EditorHandle>(null)
  const richRef = handleRef ?? fallbackRef
  const plainRef = useRef<MarkdownSource>(null)
  const seedMarkdown =
    richRef.current?.getMarkdown() ?? plainRef.current?.getMarkdown() ?? initialMarkdown ?? ''

  const taskClickHandler: TaskClickHandler = useCallback((payload) => {
    console.log('Task clicked:', payload)
  }, [])

  if (mode === 'source') {
    return (
      <div className="meowdown">
        <CodeMirrorEditor ref={plainRef} initialMarkdown={seedMarkdown} />
      </div>
    )
  }

  if (mode === 'readonly') {
    return (
      <ReadonlyView
        ref={plainRef}
        markdown={seedMarkdown}
        onWikilinkClick={richProps.onWikilinkClick}
        onLinkClick={richProps.onLinkClick}
        onImageClick={richProps.onImageClick}
        onTaskClick={taskClickHandler}
      />
    )
  }

  return (
    <MeowdownEditor handleRef={richRef} mode={mode} initialMarkdown={seedMarkdown} {...richProps}>
      {children}
    </MeowdownEditor>
  )
}
