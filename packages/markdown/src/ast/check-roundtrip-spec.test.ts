import { commonmark } from 'commonmark.json'
import { expect, it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

it.each(commonmark.map((example, index) => ({ number: index + 1, markdown: example.markdown })))(
  'spec example $number round-trips without loss',
  ({ markdown }) => {
    expect(checkRoundTrip(markdown)).not.toBe('lossy')
  },
)
