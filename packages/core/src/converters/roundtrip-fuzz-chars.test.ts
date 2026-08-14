import fc from 'fast-check'
import { it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

// Block markers, fence and emphasis punctuation, the three whitespace kinds
// that carry block structure, and one filler letter. Sampling characters
// rather than whole tokens reaches shapes a token alphabet cannot spell.
const CHARS = [...'->#*`= \n\t$|.1[]a']

const markdownArbitrary = fc.string({
  unit: fc.constantFrom(...CHARS),
  minLength: 1,
  maxLength: 16,
})

it.fails('finds no lossy input among sampled character sequences', { timeout: 60_000 }, () => {
  // Fuzz inputs reach blocks the converter warns about; the warnings are not
  // what this test measures.
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    fc.assert(
      fc.property(markdownArbitrary, (source) => {
        try {
          return checkRoundTrip(source) !== 'lossy'
        } catch {
          return false
        }
      }),
      { seed: 42, numRuns: 100_000 },
    )
  } finally {
    console.warn = originalWarn
  }
})
