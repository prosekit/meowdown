import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react'

import type { MarkdownSource } from './markdown-source.ts'

export interface CodeMirrorEditorProps {
  /**
   * The initial Markdown text of the editor. Only the value provided on the
   * first render is used; later changes are ignored.
   */
  initialMarkdown?: string

  /** Reports the current Markdown text back to the mode-flip seeding. */
  ref?: Ref<MarkdownSource>
}

export function CodeMirrorEditor({ initialMarkdown, ref }: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  // Capture the first-render value so the create effect lists no deps.
  const initialMarkdownRef = useRef(initialMarkdown ?? '')

  useImperativeHandle(
    ref,
    () => ({
      getMarkdown: () => viewRef.current?.state.doc.toString() ?? initialMarkdownRef.current,
    }),
    [],
  )

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
