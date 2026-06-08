import { createTestEditor } from '@prosekit/core/test'
import { expect, it } from 'vitest'

import { defineEditorExtension } from './extension.ts'
import { NODE_NAMES } from './node-names.ts'

it('editor schema node names match NODE_NAMES exactly', () => {
  const editor = createTestEditor({ extension: defineEditorExtension() })
  const schemaNodeNames = Object.keys(editor.schema.nodes).sort()
  expect(schemaNodeNames).toEqual([...NODE_NAMES].sort())
})
