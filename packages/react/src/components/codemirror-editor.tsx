import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { clamp } from '@ocavue/utils'
import type { SelectionJSON } from '@prosekit/core'
import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react'

import type { EditorHandle, EditorStateSnapshot, SelectionHint } from './types.ts'

function resolveSelection(selection: SelectionHint, docLength: number): EditorSelection {
  if (selection === 'start') return EditorSelection.single(0)
  if (selection === 'end') return EditorSelection.single(docLength)
  return EditorSelection.single(
    clamp(selection.anchor, 0, docLength),
    clamp(selection.head, 0, docLength),
  )
}

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
    function getMarkdown(): string {
      return viewRef.current?.state.doc.toString() ?? initialMarkdownRef.current
    }
    function getSelection(): SelectionJSON {
      const main = viewRef.current?.state.selection.main
      return { type: 'text', anchor: main?.anchor ?? 0, head: main?.head ?? 0 }
    }
    function getState(): EditorStateSnapshot {
      return [getMarkdown(), getSelection()]
    }
    function setState(markdown?: string, selection?: SelectionHint): void {
      const view = viewRef.current
      if (!view) {
        if (markdown != null) initialMarkdownRef.current = markdown
        return
      }
      if (markdown == null && !selection) return
      const docLength = markdown == null ? view.state.doc.length : markdown.length
      view.dispatch({
        changes:
          markdown == null ? undefined : { from: 0, to: view.state.doc.length, insert: markdown },
        selection: selection ? resolveSelection(selection, docLength) : undefined,
        scrollIntoView: true,
      })
    }
    function setMarkdown(markdown: string): void {
      setState(markdown)
    }
    function setSelection(selection: SelectionHint): void {
      setState(undefined, selection)
    }
    function focus(): void {
      viewRef.current?.focus()
    }
    function scrollIntoView(): void {
      viewRef.current?.dispatch({ scrollIntoView: true })
    }
    return {
      getMarkdown,
      setMarkdown,
      getState,
      setState,
      getSelection,
      setSelection,
      focus,
      scrollIntoView,
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
