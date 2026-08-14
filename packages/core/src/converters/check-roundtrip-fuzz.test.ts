import fc from 'fast-check'
import { it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

it.fails('finds no lossy input among ascii characters', { timeout: 60_000 }, () => {
  fc.assert(
    fc.property(fc.string({ unit: 'grapheme-ascii', minLength: 1, maxLength: 100 }), check),
    { seed: 1, numRuns: 100_000, verbose: true },
  )
})

it.fails('finds no lossy input among sampled character', { timeout: 60_000 }, () => {
  /// keep-sorted
  const tokens: string[] = [
    ' ',
    '_',
    '-',
    ';',
    ':',
    '!',
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
  const unit = fc.constantFrom(...tokens)
  fc.assert(fc.property(fc.string({ unit, minLength: 1, maxLength: 16 }), check), {
    seed: 2,
    numRuns: 100_000,
    verbose: true,
  })
  fc.assert(fc.property(fc.string({ unit, minLength: 17, maxLength: 60 }), check), {
    seed: 2,
    numRuns: 100_000,
    verbose: true,
  })
})

function check(input: string): boolean {
  try {
    return checkRoundTrip(input) !== 'lossy'
  } catch {
    return false
  }
}
