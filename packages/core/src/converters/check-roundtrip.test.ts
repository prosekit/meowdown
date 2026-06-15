import { describe, expect, it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

describe('checkRoundTrip', () => {
  it.each(['hello world', '# Hello\n\nWorld', '- a\n- b'])('reports exact for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('exact')
  })

  it.each([
    'a\n\n\nb', // extra blank lines collapse to one
    '- a\n\n- b', // a loose list serializes tight
  ])('reports normalizing for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('normalizing')
  })

  it.each([
    'Hello\n=====', // setext heading
    '<div class="x">hi</div>', // raw HTML block
    '* a\n* b', // bullet markers normalize to `-`
  ])('reports lossy for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('lossy')
  })
})
