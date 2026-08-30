import { createStringPicker } from '@meowdown/vitest/random'
import { sleep } from '@ocavue/utils'
import { it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

// Use a fixed seed from the environment variable for reproducibility, or fallback to a random seed
const SEED = Number.parseInt(import.meta.env.VITE_FUZZ_SEED || '') || Date.now()

const NUM_SAMPLES = 100_000

/// keep-sorted
const TOKENS_NEWLINE: readonly string[] = ['\n']

/// keep-sorted
const TOKENS_STRUCTURAL: readonly string[] = [
  ' ',
  '-',
  '*',
  '\t',
  '#',
  '`',
  '+',
  '=',
  '>',
  '|',
  '~',
  '$',
]

/// keep-sorted
const TOKENS_BASE: readonly string[] = [
  '_',
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
  '/',
  '\\',
  '&',
  '#',
  '%',
  '`',
  '^',
  '<',
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
const TOKENS_EXTENDED: readonly string[] = [
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
const TOKENS_RUNS: readonly string[] = [
  '---',
  '-->',
  '```',
  '````',
  '<?',
  '<!--',
  '<'.repeat(7),
  '='.repeat(7),
  '>'.repeat(7),
  '>',
  '| --- |',
  '~~~',
  '~~~~',
  '$$',
  '1. ',
]

function repeat(tokens: readonly string[], times: number): string[] {
  return Array.from({ length: times }, () => tokens).flat()
}

const POOLS = [
  {
    name: 'base',
    pool: [...TOKENS_BASE, ...TOKENS_RUNS],
  },
  {
    name: 'extended',
    pool: [...TOKENS_NEWLINE, ...TOKENS_BASE, ...TOKENS_RUNS, ...TOKENS_EXTENDED],
  },
  {
    name: 'weighted',
    pool: [
      ...TOKENS_BASE,
      ...TOKENS_RUNS,
      ...repeat(TOKENS_STRUCTURAL, 3),
      ...repeat(TOKENS_NEWLINE, 10),
    ],
  },
] as const

const RANGES = [
  [1, 50],
  [51, 100],
  [101, 200],
  [201, 500],
] as const

function isLossy(input: string): boolean {
  return checkRoundTrip(input) === 'lossy'
}

let testIndex = 0
for (const [minLength, maxLength] of RANGES) {
  for (const { name, pool } of POOLS) {
    testIndex++
    const seed = SEED + testIndex
    it(
      `finds no lossy input (minLength=${minLength}, maxLength=${maxLength}, pool=${name})`,
      { timeout: 60_000 },
      async () => {
        const pickString = createStringPicker(seed, minLength, maxLength, pool)
        for (let sample = 1; sample <= NUM_SAMPLES; sample++) {
          const input = pickString()
          if (isLossy(input)) {
            throw new Error(
              `lossy input (seed=${seed}, sample=${sample}, input=${JSON.stringify(input)})`,
            )
          }
          if (sample % 5_000 === 0) {
            // This might be helpful for GC in WebKit.
            await sleep(20)
          }
        }
      },
    )
  }
}
