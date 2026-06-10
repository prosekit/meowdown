import { createEditor } from '@prosekit/core'
import { describe, expect, it } from 'vitest'

import { defineEditorExtension } from '../extensions/extension.ts'

import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'

const editor = createEditor({ extension: defineEditorExtension() })

function roundtrip(markdown: string): string {
  return docToMarkdown(markdownToDoc(editor, markdown))
}

/**
 * Byte-identity guard: `docToMarkdown(markdownToDoc(md))` must reproduce the
 * input exactly, modulo the single trailing newline `docToMarkdown` always
 * appends. Each case here is markdown that editor consumers (which treat
 * markdown files as the source of truth) expect to survive a load/save cycle
 * without a spurious diff.
 */
describe('markdown round-trip is byte-identical', () => {
  const cases = [
    // Task lists (GFM `Task` / `TaskMarker`)
    '- [ ] todo',
    '- [x] done',
    '- [ ] todo\n- [x] done\n- [ ] another',
    '- [x] done\n- plain item\n- [ ] todo',
    '- [ ] parent\n  - [x] child',
    '- [ ]  double-spaced text',
    // Task marker inside an ordered list has no `task` list kind to map to;
    // the marker survives as literal paragraph text instead.
    '1. [x] done',
    // Tight lists stay tight
    '- a\n- b',
    '- parent\n  - child',
    '1. one\n1. two',
    // A genuinely loose item (two blocks) keeps its blank line
    '- a\n\n  second paragraph',
  ]

  for (const markdown of cases) {
    it(`preserves ${JSON.stringify(markdown)}`, () => {
      expect(roundtrip(markdown)).toBe(`${markdown}\n`)
    })
  }
})

describe('markdown round-trip normalizations', () => {
  it('normalizes loose single-paragraph lists to tight', () => {
    // Tightness is not stored in the document, so a loose list whose items
    // could be tight comes back tight. This is the one list normalization
    // docToMarkdown performs.
    expect(roundtrip('- a\n\n- b')).toBe('- a\n- b\n')
  })

  it('normalizes an uppercase task marker to lowercase', () => {
    expect(roundtrip('- [X] done')).toBe('- [x] done\n')
  })
})
