import { commonmark } from 'commonmark.json'
import { expect, it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

// Spec inputs that are genuinely lossy today, pinned like `LOSSY_CASES` and
// burned down over time. Every spec example survives the round trip today.
const KNOWN_LOSSY = new Set<number>()

it.each(commonmark.map((example, index) => [index + 1, example.markdown] as const))(
  'spec example %i round-trips without loss',
  (number, markdown) => {
    const fidelity = checkRoundTrip(markdown)
    if (KNOWN_LOSSY.has(number)) {
      expect(fidelity).toBe('lossy')
    } else {
      expect(fidelity).not.toBe('lossy')
    }
  },
)
