import { createEditor, type NodeJSON } from '@prosekit/core'
import { bench, describe } from 'vitest'

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

describe('docToMarkdown', () => {
  bench('sampleNode', () => {
    docToMarkdown(sampleNode)
  })

  bench('largeNode', () => {
    docToMarkdown(largeNode)
  })
})
