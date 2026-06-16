import dedent from 'dedent'
import { describe, expect, it } from 'vitest'

import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'

function roundtrip(markdown: string): string {
  return docToMarkdown(markdownToDoc(markdown))
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
    dedent`
      - [ ] todo
      - [x] done
      - [ ] another
    `,
    dedent`
      - [x] done
      - plain item
      - [ ] todo
    `,
    dedent`
      - [ ] parent
        - [x] child
    `,
    '- [ ]  double-spaced text',
    // Task marker inside an ordered list has no `task` list kind to map to;
    // the marker survives as literal paragraph text instead.
    '1. [x] done',
    // Tight lists stay tight
    dedent`
      - a
      - b
    `,
    dedent`
      - parent
        - child
    `,
    dedent`
      1. one
      1. two
    `,
    // A genuinely loose item (two blocks) keeps its blank line
    dedent`
      - a

        second paragraph
    `,
    // Tags are plain text to the converters
    'hello #meow',
    // `#tag` at line start is NOT a heading (no space after `#`)
    '#meow starts the line',
    '- [ ] #todo item',
    '> quoted #tag',
    // Wikilinks are plain text to the converters
    'see [[note]]',
    '[[note]] starts the line',
    '- [ ] [[note]] item',
    '> [[note]] quoted',
    '[[note with spaces]] and #tag',
    // Autolinks are plain text to the converters (marks decorate, not rewrite)
    'visit https://example.com now',
    'see www.example.com here',
    'mail me@example.com ok',
    'a <https://example.com> b',
    'end https://example.com.',
    // Uncommon-TLD autolinks render as plain text but must serialize unchanged
    'visit https://example.zzz now',
    'see www.foo.invalidtld here',
    'mail me@foo.zzz ok',
    'a <https://example.zzz> b',
    '[text](https://example.zzz)',
    // Embeds stay literal `![](url)` text; the embed renders as a decoration only
    '![](https://www.youtube.com/watch?v=dQw4w9WgXcQ)',
    '![](https://twitter.com/jack/status/20)',
    'text before ![](https://youtu.be/dQw4w9WgXcQ) and after',
    // Tables, including empty and partially-empty cells. The serializer writes
    // empty cells unpadded (`|  |`), so these stay unaligned to match its bytes.
    dedent`
      | a | b |
      | --- | --- |
      | 1 | 2 |
    `,
    dedent`
      |  |  |  |
      | --- | --- | --- |
      |  |  |  |
    `,
    dedent`
      | a |  | c |
      | --- | --- | --- |
      |  | b |  |
    `,
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
