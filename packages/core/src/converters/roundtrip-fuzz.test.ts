import fc from 'fast-check'
import { expect, it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

// Multi-character tokens: four of them are enough to spell real block shapes
// (marker + gap, blank-line run, content-column indent). Growing this list
// grows the searched space.
const TOKENS = [
  '-',
  '- ',
  '+ ',
  '*',
  '>',
  '# ',
  'a',
  '=',
  '`',
  '```',
  '$$',
  '1. ',
  '[ ] ',
  '| a |',
  '\n',
  '\n\n',
  ' ',
  '  ',
  '   ',
  '    ',
  '\t',
]
const MAX_TOKENS = 4

// Fuzz inputs reach blocks the converter warns about; the warnings are not
// what these tests measure.
function silenceWarnings<Result>(run: () => Result): Result {
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    return run()
  } finally {
    console.warn = originalWarn
  }
}

function isLossy(source: string): boolean {
  try {
    return checkRoundTrip(source) === 'lossy'
  } catch {
    return true
  }
}

it.fails('finds no lossy input among short token sequences', { timeout: 60_000 }, () => {
  const failures = silenceWarnings(() => {
    const found: string[] = []
    let sources = ['']
    for (let length = 1; length <= MAX_TOKENS; length++) {
      sources = sources.flatMap((head) => TOKENS.map((token) => head + token))
      for (const source of sources) {
        if (isLossy(source)) found.push(source)
      }
    }
    return found
  })
  expect(failures.slice(0, 20), `${failures.length} lossy inputs`).toEqual([])
})

it.fails('finds no lossy input among sampled longer token sequences', { timeout: 60_000 }, () => {
  const markdownArbitrary = fc
    .array(fc.constantFrom(...TOKENS), { minLength: 1, maxLength: 8 })
    .map((tokens) => tokens.join(''))
  silenceWarnings(() => {
    fc.assert(
      fc.property(markdownArbitrary, (source) => !isLossy(source)),
      { seed: 42, numRuns: 100_000 },
    )
  })
})
