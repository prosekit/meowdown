import { createEditor, type NodeJSON } from '@prosekit/core'
import { test } from 'vitest'

import { defineEditorExtension } from '../extensions/extension.ts'

import { checkRoundTrip } from './check-roundtrip.ts'
import { docToMarkdown } from './pm-to-md.ts'
import { sampleContent } from './sample-content.ts'

// Run with:  pnpm bench
//
// Latest results (chromium, M2 MacBook):
//   sampleMarkdown  10,358 hz    0.0965 ms mean
//   largeMarkdown       57 hz   17.6069 ms mean
//
// Two markdown parses and one serialization account for roughly 14 of those 18
// ms, so the line comparison is the only part worth tuning here.

const editor = createEditor({ extension: defineEditorExtension() })

const largeContent: NodeJSON = {
  type: 'doc',
  content: Array.from({ length: 200 }, () => sampleContent.content ?? []).flat(),
}

// A loose list serializes tight, so the trip is never byte-identical and the
// whole text goes through the line comparison instead of the early return.
const PERTURBATION = '- a\n\n- b\n\n'

const sampleMarkdown = PERTURBATION + docToMarkdown(editor.schema.nodeFromJSON(sampleContent))
const largeMarkdown = PERTURBATION + docToMarkdown(editor.schema.nodeFromJSON(largeContent))

test('checkRoundTrip', async ({ bench }) => {
  await bench.compare(
    bench('sampleMarkdown', () => {
      checkRoundTrip(sampleMarkdown)
    }),
    bench('largeMarkdown', () => {
      checkRoundTrip(largeMarkdown)
    }),
  )
})
