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
})
