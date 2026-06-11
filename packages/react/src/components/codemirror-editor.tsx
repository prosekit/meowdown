import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react'

import type { EditorHandle } from './types.ts'

export interface CodeMirrorEditorProps {
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

export function CodeMirrorEditor({ initialMarkdown, onDocChange, ref }: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  // Keep the latest callback in a ref so the view is never recreated when
  // the parent passes a new function identity.
  const onDocChangeRef = useRef(onDocChange)
  useLayoutEffect(() => {
    onDocChangeRef.current = onDocChange
  }, [onDocChange])

  // Capture the first-render content so the effect does not list it as a dep.
  const initialMarkdownRef = useRef(initialMarkdown ?? '')

  useImperativeHandle(ref, () => {
    return {
      getMarkdown: () => viewRef.current?.state.doc.toString() ?? initialMarkdownRef.current,
    }
  }, [])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: initialMarkdownRef.current,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown({ base: markdownLanguage }),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            onDocChangeRef.current?.()
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  return <div ref={containerRef} data-editor="codemirror" />
}
