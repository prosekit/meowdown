import dedent from 'dedent'
import { describe, expect, it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

describe('checkRoundTrip', () => {
  it.each([
    'hello world',
    dedent`
      # Hello

      World
    `,
    dedent`
      - a
      - b
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
  ])('reports exact for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('exact')
  })

  it.each([
    'a\n\n\nb', // extra blank lines collapse to one
    '- a\n\n- b', // a loose list serializes tight
  ])('reports normalizing for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('normalizing')
  })

  it.each([
    dedent`
      Hello
      =====
    `, // setext heading
    '<div class="x">hi</div>', // raw HTML block
    dedent`
      * a
      * b
    `, // bullet markers normalize to `-`
  ])('reports lossy for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('lossy')
  })
})
