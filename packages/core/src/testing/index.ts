import '../style.css'

import { createTestEditor } from '@prosekit/core/test'
import type { EditorNode } from '@prosekit/pm/model'

import { defineEditorExtension } from '../extensions/extension.ts'
import type { MarkMode } from '../extensions/mark-mode-plugin.ts'

export interface SetupTestEnvOptions {
  /** Whether to mount the editor onto a real DOM container. Defaults to `true`. */
  mount?: boolean
  /** The mark mode to configure the editor with. Defaults to `'focus'`. */
  markMode?: MarkMode
}

export function setupTestEnv({ mount = true, markMode }: SetupTestEnvOptions = {}) {
  const extension = defineEditorExtension({ markMode })
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

    [Symbol.dispose]() {
      dispose()
    },
  }
}

export type TestEnv = ReturnType<typeof setupTestEnv>

function getTestContainer(): HTMLDivElement {
  const id = 'test-container'
  const existing = document.getElementById(id)
  if (existing) existing.remove()
  const div = document.createElement('div')
  div.id = id
  document.body.appendChild(div)
  return div
}
