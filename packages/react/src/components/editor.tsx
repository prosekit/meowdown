import type { MarkMode } from '@meowdown/core'
import type { SelectionJSON } from '@prosekit/core'
import { useImperativeHandle, useRef, type Ref } from 'react'

import { CodeMirrorEditor } from './codemirror-editor.tsx'
import { ProseKitEditor } from './prosekit-editor.tsx'
import type {
  EditorHandle,
  EditorStateSnapshot,
  SelectionHint,
  TagSearchHandler,
  WikilinkSearchHandler,
} from './types.ts'

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

  /**
   * Searches tags for the tag menu, which opens when typing `#` followed by
   * text in a rich mode. Receives the query (lowercased, punctuation
   * stripped) and returns the tags to show, synchronously or as a promise.
   * Pass a stable function (e.g. from `useCallback`). Omit to disable the
   * tag menu. Ignored in source mode.
   */
  onTagSearch?: TagSearchHandler

  /**
   * Searches notes for the wikilink menu, which opens as soon as `[[` is
   * typed in a rich mode. Receives the query (lowercased, punctuation
   * stripped, may be empty) and returns the note names to show,
   * synchronously or as a promise. Pass a stable function (e.g. from
   * `useCallback`). Omit to disable the wikilink menu. Ignored in source
   * mode.
   */
  onWikilinkSearch?: WikilinkSearchHandler

  /**
   * Enables the browser's native spell checking in the rich modes. Defaults
   * to the browser's behavior. Ignored in source mode.
   */
  spellCheck?: boolean

  /** Imperative handle for the editor. */
  ref?: Ref<EditorHandle>
}

export function Editor({
  mode = 'focus',
  initialMarkdown,
  onDocChange,
  onTagSearch,
  onWikilinkSearch,
  spellCheck,
  ref,
}: EditorProps) {
  // Handle of whichever editor is currently mounted.
  const childRef = useRef<EditorHandle>(null)

  useImperativeHandle(ref, () => {
    function getMarkdown(): string {
      return childRef.current?.getMarkdown() ?? ''
    }
    function setMarkdown(markdown: string): void {
      childRef.current?.setMarkdown(markdown)
    }
    function getState(): EditorStateSnapshot {
      return childRef.current?.getState() ?? ['', { type: 'text', anchor: 0, head: 0 }]
    }
    function setState(markdown?: string, selection?: SelectionHint): void {
      childRef.current?.setState(markdown, selection)
    }
    function getSelection(): SelectionJSON {
      return childRef.current?.getSelection() ?? { type: 'text', anchor: 0, head: 0 }
    }
    function setSelection(selection: SelectionHint): void {
      childRef.current?.setSelection(selection)
    }
    function focus(): void {
      childRef.current?.focus()
    }
    function scrollIntoView(): void {
      childRef.current?.scrollIntoView()
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

  // Seed for the mounted editor: the initial markdown on the first render,
  // the previous editor's content when the mode family flips.
  const seedMarkdown = childRef.current?.getMarkdown() ?? initialMarkdown ?? ''

  return (
    <div className="meowdown">
      {mode === 'source' ? (
        <CodeMirrorEditor ref={childRef} initialMarkdown={seedMarkdown} onDocChange={onDocChange} />
      ) : (
        <ProseKitEditor
          ref={childRef}
          markMode={mode}
          initialMarkdown={seedMarkdown}
          onDocChange={onDocChange}
          onTagSearch={onTagSearch}
          onWikilinkSearch={onWikilinkSearch}
          spellCheck={spellCheck}
        />
      )}
    </div>
  )
}
