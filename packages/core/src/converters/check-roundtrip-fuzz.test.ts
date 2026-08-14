import fc from 'fast-check'
import { it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

const NUM_RUNS = 1_000_000
const MIN_LENGTH = 1
const MAX_LENGTH = 100
const SEED = Date.now() % (1<<30)

/// keep-sorted
const TOKENS: string[] = [
  ' ',
  '_',
  '-',
  ';',
  ':',
  '!',
  '?',
  '.',
  '"',
  '(',
  ')',
  '[',
  ']',
  '*',
  '/',
  '\\',
  '\n',
  '\t',
  '#',
  '`',
  '+',
  '<',
  '=',
  '>',
  '|',
  '~',
  '$',
  '1',
  '2',
  '3',
  'a',
  'b',
]

it('finds no lossy input among ascii characters', { timeout: 60_000 }, () => {
  fc.assert(
    fc.property(
      fc.string({
        unit: 'grapheme-ascii',
        minLength: MIN_LENGTH,
        maxLength: MAX_LENGTH,
      }),
      check,
    ),
    { seed: SEED, numRuns: NUM_RUNS, verbose: true },
  )
})

it('finds no lossy input among sampled characters', { timeout: 60_000 }, () => {
  fc.assert(
    fc.property(
      fc.string({
        unit: fc.constantFrom(...TOKENS),
        minLength: MIN_LENGTH,
        maxLength: MAX_LENGTH,
      }),
      check,
    ),
    { seed: SEED, numRuns: NUM_RUNS, verbose: true },
  )
})

function check(input: string): boolean {
  try {
    return checkRoundTrip(input) !== 'lossy'
  } catch {
    return false
  }
}
