import { createMarkBuilders } from '@prosekit/core'
import { test } from 'vitest'

import { defineEditorExtension, type EditorExtension } from './extension.ts'
import { inlineTextToMarkChunks } from './inline-text-to-mark-chunks.ts'

// Run with:  pnpm bench
//
// Latest results (Node 24, single thread, M2 MacBook):
//   plain      237,522 hz    0.0042 ms mean
//   mixed       83,568 hz    0.0120 ms mean
//   long         1,606 hz    0.6225 ms mean

const plainParagraph = 'A plain paragraph with no markdown inline syntax in sight.'

const mixedParagraph =
  'Here is a paragraph with *italic*, **bold**, ~~strike~~, ' +
  '`code`, and a [link](https://example.test) plus some plain text ' +
  'in the middle just to add length and texture.'

const longParagraph = (mixedParagraph + ' ').repeat(50)

const schema = defineEditorExtension().schema!
const markBuilders = createMarkBuilders<EditorExtension>(schema)

test('inlineTextToMarkChunks', async ({ bench }) => {
  await bench('plain', () => {
    inlineTextToMarkChunks(markBuilders, plainParagraph)
  }).run()

  await bench('mixed', () => {
    inlineTextToMarkChunks(markBuilders, mixedParagraph)
  }).run()

  await bench('long', () => {
    inlineTextToMarkChunks(markBuilders, longParagraph)
  }).run()
})
