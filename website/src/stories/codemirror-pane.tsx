import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap } from '@codemirror/view'
import { useLayoutEffect, useRef, type RefObject } from 'react'

import { useDocumentTheme } from './use-document-theme.ts'

export interface CodeMirrorPaneProps {
  initialDoc: string
  readOnly: boolean
  viewRef: RefObject<EditorView | null>
  /**
   * Fires with the full source text when the pane loses focus. Must be stable
   * (useCallback): the mount effect captures it once when the view is created.
   */
  onBlur: (markdown: string) => void
}

const themeCompartment = new Compartment()
const readOnlyCompartment = new Compartment()

function readOnlyExtensions(readOnly: boolean) {
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]
}

function themeExtensions(theme: 'light' | 'dark') {
  return theme === 'dark' ? oneDark : syntaxHighlighting(defaultHighlightStyle, { fallback: true })
}

export function CodeMirrorPane({ initialDoc, readOnly, viewRef, onBlur }: CodeMirrorPaneProps) {
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
          EditorView.domEventHandlers({
            blur: (_event, blurredView) => {
              onBlur(blurredView.state.doc.toString())
            },
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
    // the blur callback are stable, and toggling the pane remounts it.
  }, [initialDoc, onBlur, viewRef])

  useLayoutEffect(() => {
    viewRef.current?.dispatch({ effects: themeCompartment.reconfigure(themeExtensions(theme)) })
  }, [theme, viewRef])

  useLayoutEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartment.reconfigure(readOnlyExtensions(readOnly)),
    })
  }, [readOnly, viewRef])

  return <div ref={containerRef} className="story-source" />
}
