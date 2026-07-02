import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorSelection, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import type {
  EditorHandle,
  EditorStateSnapshot,
  SelectionHint,
  SelectionJSON,
} from '@meowdown/react'
import { clamp } from '@ocavue/utils'
import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react'

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

  /** Called on every user-driven document change, not on programmatic setState. */
  onDocChange?: VoidFunction

  /** Makes the editor read-only. */
  readOnly?: boolean

  /** Imperative handle for the editor. */
  ref?: Ref<EditorHandle>
}

export function CodeMirrorEditor({
  initialMarkdown,
  onDocChange,
  readOnly,
  ref,
}: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const readOnlyCompartmentRef = useRef(new Compartment())

  // Set while a programmatic setState/setMarkdown dispatch runs, so the update
  // listener can ignore it: a host replacing content already knows.
  const suppressDocChangeRef = useRef(false)

  // Keep the latest callback in a ref so the view is never recreated when
  // the parent passes a new function identity.
  const onDocChangeRef = useRef(onDocChange)
  useLayoutEffect(() => {
    onDocChangeRef.current = onDocChange
  }, [onDocChange])

  // Capture the first-render values so the create effect lists no deps.
  const initialMarkdownRef = useRef(initialMarkdown ?? '')
  const initialReadOnlyRef = useRef(readOnly ?? false)

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
      suppressDocChangeRef.current = true
      try {
        view.dispatch({
          changes:
            markdown == null ? undefined : { from: 0, to: view.state.doc.length, insert: markdown },
          selection: selection ? resolveSelection(selection, docLength) : undefined,
          scrollIntoView: true,
        })
      } finally {
        suppressDocChangeRef.current = false
      }
    }
    function setMarkdown(markdown: string): void {
      setState(markdown)
    }
    function insertMarkdown(_markdown: string): void {
      throw new Error('CodeMirrorEditor.insertMarkdown is not implemented')
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
    function getSelectedText(): string {
      const view = viewRef.current
      if (!view) return ''
      const main = view.state.selection.main
      return view.state.sliceDoc(main.from, main.to)
    }
    return {
      getMarkdown,
      setMarkdown,
      insertMarkdown,
      getState,
      setState,
      getSelection,
      setSelection,
      focus,
      scrollIntoView,
      getSelectedText,
      // The raw-Markdown editor has no selection menu or staged replacements.
      openSelectionMenu: () => {},
      startPendingReplacement: () => false,
      appendPendingReplacementText: () => {},
      acceptPendingReplacement: () => {},
      discardPendingReplacement: () => {},
      editor: undefined,
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
          readOnlyCompartmentRef.current.of(EditorState.readOnly.of(initialReadOnlyRef.current)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || suppressDocChangeRef.current) return
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

  useLayoutEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(
        EditorState.readOnly.of(readOnly ?? false),
      ),
    })
  }, [readOnly])

  return <div ref={containerRef} data-editor="codemirror" />
}
