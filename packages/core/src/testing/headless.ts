import { createTestEditor } from '@prosekit/core/test'
import type { EditorNode } from '@prosekit/pm/model'

import { defineEditorExtension, type EditorExtensionOptions } from '../extensions/extension.ts'

import { getSelectionSnapshot } from './selection-snapshot.ts'

/**
 * An editor fixture without a DOM, for tests that only need the document and
 * the state. Import it from `*.test.ts`; `setupFixture` in `./index.ts` mounts
 * a real editor and only works in `*.test.tsx`.
 */
export function setupHeadlessFixture(extensionOptions?: EditorExtensionOptions) {
  const extension = defineEditorExtension(extensionOptions)
  const editor = createTestEditor({ extension })

  return {
    editor,
    n: editor.nodes,
    m: editor.marks,

    get schema() {
      return editor.schema
    },

    get state() {
      return editor.state
    },

    get doc() {
      return editor.state.doc
    },

    get selectionSnapshot() {
      const snapshot = getSelectionSnapshot(editor.state)
      // Wrap the snapshot in newlines if it contains multiple lines, so that snapshot testing is easier to read and diff.
      return snapshot.includes('\n') ? `\n${snapshot}\n` : snapshot
    },

    set(doc: EditorNode) {
      editor.set(doc)
    },
  }
}
