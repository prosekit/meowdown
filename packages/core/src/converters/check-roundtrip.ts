import { createEditor } from '@prosekit/core'

import { defineEditorExtension, type TypedEditor } from '../extensions/extension.ts'

import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'

/**
 * How faithfully markdown survives a parse-then-serialize round trip:
 * - `exact`: byte-identical (modulo the trailing newline).
 * - `normalizing`: same non-blank lines, only blank-line layout differs.
 * - `lossy`: a non-blank line changed, so content would be lost or altered.
 */
export type RoundTripFidelity = 'exact' | 'normalizing' | 'lossy'

let sharedEditor: TypedEditor | undefined

function getSharedEditor(): TypedEditor {
  sharedEditor ??= createEditor({ extension: defineEditorExtension() })
  return sharedEditor
}

function trimTrailingNewlines(text: string): string {
  return text.replace(/\n+$/u, '')
}

function nonBlankLines(text: string): string[] {
  return text.split('\n').filter((line) => line.trim() !== '')
}

/** Classify how `markdown` survives the editor's parse-then-serialize round trip. */
export function checkRoundTrip(markdown: string): RoundTripFidelity {
  const serialized = docToMarkdown(markdownToDoc(getSharedEditor(), markdown))
  if (trimTrailingNewlines(serialized) === trimTrailingNewlines(markdown)) return 'exact'
  const before = nonBlankLines(markdown)
  const after = nonBlankLines(serialized)
  if (before.length === after.length && before.every((line, index) => line === after[index])) {
    return 'normalizing'
  }
  return 'lossy'
}
