import '../style.css'

import './locator.ts'

import { createTestEditor } from '@prosekit/core/test'
import type { EditorNode } from '@prosekit/pm/model'

import { defineEditorExtension } from '../extensions/extension.ts'
import { getSelectionSnapshot } from './selection-snapshot.ts'
import   { formatHTML } from 'diffable-html-snapshot'

export { getSelectionSnapshot } from './selection-snapshot.ts'
export { setCaret, traceKeySelection, traceKeyAt } from './caret.ts'

export interface SetupFixtureOptions {
  /** Whether to mount the editor onto a real DOM container. Defaults to `true`. */
  mount?: boolean
}

export function setupFixture({ mount = true }: SetupFixtureOptions = {}) {
  const extension = defineEditorExtension()
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

    get selectionSnapshot() {
      return getSelectionSnapshot(editor.view.state)
    },

    get htmlSnapshot() {
      return formatHTML(editor.view.dom.innerHTML)
    },

    set(doc: EditorNode) {
      editor.set(doc)
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
