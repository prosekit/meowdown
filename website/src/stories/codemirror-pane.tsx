import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState, Transaction } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap } from '@codemirror/view'
import { useLayoutEffect, useRef, type RefObject } from 'react'

import { useDocumentTheme } from './use-document-theme.ts'

export interface CodeMirrorPaneProps {
  initialDoc: string
  readOnly: boolean
  viewRef: RefObject<EditorView | null>
  /**
   * Fires with the full source text after every edit made here. Writes coming
   * from the rich pane carry `Transaction.remote` and are not reported. Must be
   * stable (useCallback): the mount effect captures it once when the view is
   * created.
   */
  onChange: (markdown: string) => void
  /**
   * Fires when the pane takes focus, before any keystroke can reach it. Must be
   * stable (useCallback): the mount effect captures it once when the view is
   * created.
   */
  onFocus: VoidFunction
}

const themeCompartment = new Compartment()
const readOnlyCompartment = new Compartment()

function readOnlyExtensions(readOnly: boolean) {
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]
}

function themeExtensions(theme: 'light' | 'dark') {
  return theme === 'dark' ? oneDark : syntaxHighlighting(defaultHighlightStyle, { fallback: true })
}

export function CodeMirrorPane({
  initialDoc,
  readOnly,
  viewRef,
  onChange,
  onFocus,
}: CodeMirrorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const theme = useDocumentTheme()

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: initialDoc,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown({ base: markdownLanguage }),
          EditorView.lineWrapping,
          themeCompartment.of(themeExtensions('light')),
          readOnlyCompartment.of(readOnlyExtensions(false)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            if (update.transactions.some((tr) => tr.annotation(Transaction.remote))) return
            onChange(update.state.doc.toString())
          }),
          EditorView.domEventHandlers({
            focus: () => onFocus(),
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // In practice these never change while the pane is mounted: the seed and
    // the callbacks are stable, and toggling the pane remounts it.
  }, [initialDoc, onChange, onFocus, viewRef])

  useLayoutEffect(() => {
    viewRef.current?.dispatch({ effects: themeCompartment.reconfigure(themeExtensions(theme)) })
  }, [theme, viewRef])

  useLayoutEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartment.reconfigure(readOnlyExtensions(readOnly)),
    })
  }, [readOnly, viewRef])

  // The .cm-content gutter matches .ProseMirror's so the two panes align.
  return (
    <div
      ref={containerRef}
      className="flex flex-[1_0_auto] [&_.cm-content]:px-(--meowdown-gutter) [&_.cm-content]:pt-5 [&_.cm-content]:pb-7 [&_.cm-content]:font-(family-name:--meowdown-font-mono) [&_.cm-content]:caret-(--meowdown-accent) [&_.cm-editor]:flex-1 [&_.cm-editor]:text-[0.95rem] [&_.cm-editor.cm-focused]:outline-none"
    />
  )
}
