import dedent from 'dedent'
import { describe, expect, it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

describe('checkRoundTrip', () => {
  it.each([
    'hello world',
    '<div class="x">hi</div>',
    dedent`
      # Hello

      World
    `,
    dedent`
      - a
      - b
    `,
    dedent`
      * a
      * b
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

    // setext heading keeps its text and underline length
    dedent`
      Hello
      =====
    `,

    // a list item's soft-wrapped paragraph keeps its indent
    dedent`
      - x

        line one
        line two
    `,
    // nested list, same
    dedent`
      - a
        - x

          line one
          line two
    `,
  ])('reports exact for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('exact')
  })

  it.each([
    'a\n\n\nb', // extra blank lines collapse to one
    '- a\n\n- b', // a loose list serializes tight
    '- [ ] Asdf\n- [ ]\n- [ ] ', // a trailing space on an empty task is normalized away
    'trailing spaces   ', // trailing whitespace is insignificant
    '> text\n> - item', // a blockquote gains an empty `>` line before a following list
    '> a\n> - x\n> - y', // same, with a multi-item list inside the blockquote
    '- [ ] todo\neen voorlopig idee', // a lazy continuation gains the canonical item indent
    '- item\nlazy line', // same, on a plain bullet
  ])('reports normalizing for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('normalizing')
  })

  it.each([
    '# Hello #', // a closing ATX hash sequence is dropped (same line count, content differs)
    '    indented', // an indented code block becomes a fence: the non-blank line count grows
    '~~~\ntilde\n~~~', // a tilde fence becomes a backtick fence: same line count, content differs
  ])('reports lossy for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('lossy')
  })

  it.fails('reports normalizing for a heading with a double marker space', () => {
    // The serializer collapses two spaces after the ATX `#` to one
    // (`#  Journal` becomes `# Journal`), which is layout, not content: the heading
    // text and the re-parsed doc are unchanged. But `nonBlankLines` compares with
    // `line.trim()`, which keeps the internal double space, so the lines read as
    // different content and an otherwise faithful note is wrongly flagged `lossy`.
    const markdown = ['#  Journal', '', 'A paragraph of body text.'].join('\n')
    expect(checkRoundTrip(markdown)).toBe('normalizing')
  })
})
