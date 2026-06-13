import '../style.css'

import './locator.ts'

import { union, type Extension } from '@prosekit/core'
import { createTestEditor } from '@prosekit/core/test'
import type { EditorNode } from '@prosekit/pm/model'

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
