import '../style.css'

import './locator.ts'

import { union, type Extension } from '@prosekit/core'
import { createTestEditor, pasteFiles, pasteText } from '@prosekit/core/test'
import type { EditorNode } from '@prosekit/pm/model'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { defineEditorExtension } from '../extensions/extension.ts'

export interface SetupFixtureOptions {
  /** Whether to mount the editor onto a real DOM container. Defaults to `true`. */
  mount?: boolean
  /** An extra extension unioned with the base at creation (facet handlers
   * must be installed at creation, not via `editor.use`). */
  extension?: Extension
}

export function setupFixture({ mount = true, extension: extra }: SetupFixtureOptions = {}) {
  const extension = extra ? union(defineEditorExtension(), extra) : defineEditorExtension()
  const editor = createTestEditor({ extension })
  const n = editor.nodes
  const m = editor.marks

  const div = getTestContainer()

  if (mount) {
    editor.mount(div)
  }

  const dispose = () => {
    if (mount) {
      editor.unmount()
    }
  }

  return {
    editor,
    n,
    m,

    get schema() {
      return editor.schema
    },

    get view() {
      return editor.view
    },

    get state() {
      return editor.view.state
    },

    get doc() {
      return editor.view.state.doc
    },

    get dom() {
      return editor.view.dom
    },

    set(doc: EditorNode) {
      editor.set(doc)
    },

    /** Serialize the current document to Markdown. */
    getMarkdown(): string {
      return docToMarkdown(editor.view.state.doc)
    },

    /**
     * Simulate a paste. Uses `@prosekit/core/test`'s `pasteFiles` / `pasteText`
     * for file-only or text-only clipboards, and a real `paste` event when both
     * are present (to check the text is ignored alongside an image).
     */
    paste(files: File[], text?: string): void {
      if (text === undefined) {
        pasteFiles(editor.view, files)
      } else if (files.length === 0) {
        pasteText(editor.view, text)
      } else {
        const data = new DataTransfer()
        data.setData('text/plain', text)
        for (const file of files) data.items.add(file)
        editor.view.dom.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
        )
      }
    },

    /** Simulate a file drop at the given client coordinates. */
    drop(files: File[], left: number, top: number): void {
      const dataTransfer = new DataTransfer()
      for (const file of files) dataTransfer.items.add(file)
      editor.view.dom.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer,
          clientX: left,
          clientY: top,
          bubbles: true,
          cancelable: true,
        }),
      )
    },

    [Symbol.dispose]() {
      dispose()
    },
  }
}

export type Fixture = ReturnType<typeof setupFixture>

function getTestContainer(): HTMLDivElement {
  const id = 'test-container'
  const existing = document.getElementById(id)
  if (existing) existing.remove()
  const div = document.createElement('div')
  div.id = id
  document.body.appendChild(div)
  return div
}
