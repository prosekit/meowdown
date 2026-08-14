import fc from 'fast-check'
import { it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

// Use a fixed seed for reproducibility from the environment variable, or fallback to a random seed
const SEED = Number.parseInt(import.meta.env.VITE_FUZZ_SEED) || Date.now() % (1 << 30)

const NUM_RUNS = 100_000

/// keep-sorted
const TOKENS_BASE: string[] = [
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

// More characters markdown gives meaning to, sampled from the CommonMark, GFM,
// micromark and markdown-it test suites. Control and non-ASCII characters get
// their only coverage here, since the `grapheme-ascii` unit generates printable
// ASCII alone.
/// keep-sorted
const TOKENS_EXTENDED: string[] = [
  ',',
  '’',
  '«',
  '{',
  '}',
  '@',
  '\f',
  '\u{200D}',
  '\u{300}',
  '\u{3000}',
  '\u{A0}',
  '\u{FEFF}',
  '\u{FFFD}',
  '\v',
  '&',
  '%',
  '^',
  '🍄',
  '0',
  '9',
  'A',
  '片',
  "'",
]

const UNITS = [
  { name: 'grapheme-ascii', unit: 'grapheme-ascii' },
  { name: 'base', unit: fc.constantFrom(...TOKENS_BASE) },
  { name: 'extended', unit: fc.constantFrom(...TOKENS_BASE, ...TOKENS_EXTENDED) },
]

const RANGES = [
  [1, 50],
  [51, 100],
  [101, 200],
  [201, 500],
] as const

for (const [minLength, maxLength] of RANGES) {
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
