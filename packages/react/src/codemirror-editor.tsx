import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { useLayoutEffect, useRef } from 'react'

import type { ChangeHandlerOptions } from './types.ts'

export interface CodeMirrorEditorProps {
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

export function CodeMirrorEditor({ initialContent, onChange }: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep the latest callback in a ref so the view is never recreated when
  // the parent passes a new function identity.
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Capture the first-render content so the effect does not list it as a dep.
  const initialContentRef = useRef(initialContent ?? '')

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: initialContentRef.current,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown({ base: markdownLanguage }),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            onChangeRef.current?.({
              getMarkdown: () => view.state.doc.toString(),
            })
          }),
        ],
      }),
    })
    return () => view.destroy()
  }, [])

  return <div ref={containerRef} data-editor="codemirror" />
}
