import fc from 'fast-check'
import { it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

const NUM_RUNS = 100_000
const SEED = (Date.now()) % (1 << 31)

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

for (const [minLength, maxLength] of [
  [1, 20],
  [21, 100],
  [101, 200],
  [201, 500],
]) {
  for (const customToken of [false, true]) {
    it(
      `finds no lossy input (minLength=${minLength}, maxLength=${maxLength}, customToken=${customToken}`,
      { timeout: 60_000 },
      () => {
        runTest(SEED, minLength, maxLength, customToken)
      },
    )
  }
}

function runTest(seed: number, minLength: number, maxLength: number, customToken: boolean) {
  fc.assert(
    fc.property(
      fc.string({
        unit: customToken ? fc.constantFrom(...TOKENS) : 'grapheme-ascii',
        minLength,
        maxLength,
      }),
      check,
    ),
    { seed, numRuns: NUM_RUNS, verbose: true },
  )
}

function check(input: string): boolean {
  try {
    return checkRoundTrip(input) !== 'lossy'
  } catch {
    return false
  }
}
