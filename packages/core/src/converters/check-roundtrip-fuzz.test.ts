import fc from 'fast-check'
import { it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

// Use a fixed seed from the environment variable for reproducibility, or fallback to a random seed
const SEED = Number.parseInt(import.meta.env.VITE_FUZZ_SEED || '') || Date.now() % (1 << 30)

const NUM_RUNS = 100_000

/// keep-sorted
const TOKENS_BASE: string[] = [
  ' ',
  '_',
  '-',
  ',',
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
  '{',
  '}',
  '@',
  '*',
  '/',
  '\\',
  '\n',
  '\t',
  '&',
  '#',
  '%',
  '`',
  '^',
  '+',
  '<',
  '=',
  '>',
  '|',
  '~',
  '$',
  '0',
  '1',
  '2',
  '3',
  '9',
  'a',
  'A',
  'b',
  "'",
]

/// keep-sorted
const TOKENS_EXTENDED: string[] = [
  '’',
  '«',
  '\f',
  '\r\n',
  '\u{200D}',
  '\u{300}',
  '\u{3000}',
  '\u{A0}',
  '\u{FEFF}',
  '\u{FFFD}',
  '\v',
  '🍄',
  '€',
  '永',
]

/// keep-sorted
const TOKENS_RUNS: string[] = [
  '---',
  '-->',
  '```',
  '````',
  '<!--',
  '<?',
  '<<<<<<< ',
  '===',
  '> ',
  '>>>>>>> ',
  '| --- |',
  '~~~',
  '~~~~',
  '$$',
  '1. ',
]

/// keep-sorted
const TOKENS_STRUCTURAL: string[] = [' ', '-', '*', '\t', '#', '`', '+', '=', '>', '|', '~', '$']

const UNITS = [
  { name: 'base', unit: fc.constantFrom(...TOKENS_BASE, ...TOKENS_RUNS) },
  { name: 'extended', unit: fc.constantFrom(...TOKENS_BASE, ...TOKENS_RUNS, ...TOKENS_EXTENDED) },
  // the base alphabet re-weighted toward newlines and block markers
  {
    name: 'weighted',
    unit: fc.oneof(
      { arbitrary: fc.constant('\n'), weight: 20 },
      { arbitrary: fc.constantFrom(...TOKENS_STRUCTURAL), weight: 40 },
      { arbitrary: fc.constantFrom(...TOKENS_BASE, ...TOKENS_RUNS), weight: 40 },
    ),
  },
] as const

const RANGES = [
  [1, 50],
  [51, 100],
  [101, 200],
  [201, 500],
] as const

for (const [minLength, maxLength] of RANGES) {
  for (const unit of UNITS) {
    it(
      `finds no lossy input (minLength=${minLength}, maxLength=${maxLength}, unit=${unit.name})`,
      { timeout: 60_000 },
      () => {
        fc.assert(
          fc.property(
            fc.string({
              unit: unit.unit,
              minLength,
              maxLength,
              size: 'max',
            }),
            check,
          ),
          { seed: SEED, numRuns: NUM_RUNS, verbose: true },
        )
      },
    )
  }
}

function check(input: string): boolean {
  try {
    return checkRoundTrip(input) !== 'lossy'
  } catch {
    return false
  }
}
