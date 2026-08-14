import fc from 'fast-check'
import { it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

it.fails('finds no lossy input among ascii characters', { timeout: 60_000 }, () => {
  fc.assert(
    fc.property(fc.string({ unit: 'grapheme-ascii', minLength: 1, maxLength: 100 }), check),
    { seed: 1, numRuns: 100_000, verbose: true },
  )
})

it('finds no lossy input among sampled character', { timeout: 60_000 }, () => {
  const tokens: string[] = [...'->#*`= \n\t$|.1[]a']
  const markdownArbitrary = fc.string({
    unit: fc.constantFrom(...tokens),
    minLength: 1,
    maxLength: 32,
  })
  fc.assert(fc.property(markdownArbitrary, check), { seed: 2, numRuns: 100_000, verbose: true })
})

function check(input: string): boolean {
  try {
    return checkRoundTrip(input) !== 'lossy'
  } catch {
    return false
  }
}
