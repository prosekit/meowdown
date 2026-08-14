import fc from 'fast-check'
import { it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

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

const CONFIG = { seed: 1, numRuns: 1_000_000, verbose: true } satisfies fc.Parameters

it('finds no lossy input among ascii characters', { timeout: 60_000 }, () => {
  fc.assert(
    fc.property(fc.string({ unit: 'grapheme-ascii', minLength: 1, maxLength: 200 }), check),
    CONFIG,
  )
})

it.fails('finds no lossy input among sampled characters', { timeout: 60_000 }, () => {
  const unit = fc.constantFrom(...TOKENS)
  fc.assert(fc.property(fc.string({ unit, minLength: 1, maxLength: 200 }), check), CONFIG)
})

function check(input: string): boolean {
  try {
    return checkRoundTrip(input) !== 'lossy'
  } catch {
    return false
  }
}
