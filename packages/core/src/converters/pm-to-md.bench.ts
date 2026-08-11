import { createEditor, type NodeJSON } from '@prosekit/core'
import { test } from 'vitest'

import { defineEditorExtension } from '../extensions/extension.ts'

import { docToMarkdown } from './pm-to-md.ts'
import { sampleContent } from './sample-content.ts'

// Run with:  pnpm bench
//
// Latest results (Node 24, single thread, M2 MacBook):
//   sampleNode  201,026 hz    0.0050 ms mean
//   largeNode     1,016 hz    0.9843 ms mean

const editor = createEditor({ extension: defineEditorExtension() })

const largeContent: NodeJSON = {
  type: 'doc',
  content: Array.from({ length: 200 }, () => sampleContent.content ?? []).flat(),
}

const sampleNode = editor.schema.nodeFromJSON(sampleContent)
const largeNode = editor.schema.nodeFromJSON(largeContent)

test('docToMarkdown', async ({ bench }) => {
  await bench('sampleNode', () => {
    docToMarkdown(sampleNode)
  }).run()

  await bench('largeNode', () => {
    docToMarkdown(largeNode)
  }).run()
})
