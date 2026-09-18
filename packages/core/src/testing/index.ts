import '../style.css'

import './locator.ts'

import type { EditorNode } from '@prosekit/pm/model'
import { formatHTML } from 'diffable-html-snapshot'

import type { EditorExtensionOptions } from '../extensions/extension.ts'
import { defineVirtualCaret } from '../extensions/virtual-caret.ts'

import { setupHeadlessFixture } from './headless.ts'

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
  const headless = setupHeadlessFixture(extensionOptions)
  const { editor, n, m } = headless

  let container: HTMLDivElement | undefined
  let caretLayer: HTMLDivElement | undefined

  if (mount) {
    container = getTestContainer(containerId)
    // Mirror the react host: the caret layer sits right before the editor
    // element (`mount` turns `container` itself into the editable root).
    caretLayer = document.createElement('div')
    editor.mount(container)
    container.insertAdjacentElement('beforebegin', caretLayer)
    editor.use(defineVirtualCaret(caretLayer))
  }

  const dispose = () => {
    if (mount) {
      editor.unmount()
    }
    caretLayer?.remove()
    container?.remove()
  }

  return {
    editor,
    n,
    m,

    get schema() {
      return headless.schema
    },

    get view() {
      return editor.view
    },

    get state() {
      return headless.state
    },

    get doc() {
      return headless.doc
    },

    get dom() {
      return editor.view.dom
    },

    get selectionSnapshot() {
      return headless.selectionSnapshot
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
