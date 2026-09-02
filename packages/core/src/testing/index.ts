import '../style.css'

import './locator.ts'

import { createTestEditor } from '@prosekit/core/test'
import type { EditorNode } from '@prosekit/pm/model'
import { formatHTML } from 'diffable-html-snapshot'

import { defineEditorExtension, type EditorExtensionOptions } from '../extensions/extension.ts'
import { defineVirtualCaret } from '../extensions/virtual-caret.ts'

import { getSelectionSnapshot } from './selection-snapshot.ts'

export { resolveWikilinkAlias } from './resolve-wikilink-alias.ts'
export { getSelectionSnapshot } from './selection-snapshot.ts'
export {
  formatSelectionSteps,
  traceKeyAt,
  traceKeySelection,
  traceShiftKeySelection,
} from './caret.ts'

export interface SetupFixtureOptions {
  /**
   * Whether to mount the editor onto a real DOM container. Defaults to `true`.
   */
  mount?: boolean
  /**
   * Creation-time options for `defineEditorExtension` (e.g. `resolveFileLink`).
   */
  extensionOptions?: EditorExtensionOptions
  /**
   * The container's DOM id. Two fixtures need two ids to stay mounted at once.
   */
  containerId?: string
}

export function setupFixture({
  mount = true,
  extensionOptions,
  containerId = 'test-container',
}: SetupFixtureOptions = {}) {
  const extension = defineEditorExtension(extensionOptions)
  const editor = createTestEditor({ extension })
  const n = editor.nodes
  const m = editor.marks

  const div = getTestContainer(containerId)

  // Mirror the react host: the caret layer sits right before the editor
  // element (`mount` turns `div` itself into the editable root).
  const caretLayer = document.createElement('div')

  if (mount) {
    editor.mount(div)
    div.insertAdjacentElement('beforebegin', caretLayer)
    editor.use(defineVirtualCaret(caretLayer))
  }

  const dispose = () => {
    if (mount) {
      editor.unmount()
    }
    caretLayer.remove()
    div.remove()
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
      const snapshot = getSelectionSnapshot(editor.view.state)
      // Wrap the snapshot in newlines if it contains multiple lines, so that snapshot testing is easier to read and diff.
      return snapshot.includes('\n') ? `\n${snapshot}\n` : snapshot
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

function getTestContainer(id: string): HTMLDivElement {
  const existing = document.getElementById(id)
  if (existing) existing.remove()
  const div = document.createElement('div')
  div.id = id
  document.body.appendChild(div)
  return div
}
