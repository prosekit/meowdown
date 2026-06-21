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
    dedent`
      Hello
      =====
    `, // setext heading keeps its text and underline length
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
    '# Hello #', // a closing ATX hash sequence is dropped
  ])('reports lossy for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('lossy')
  })
})
