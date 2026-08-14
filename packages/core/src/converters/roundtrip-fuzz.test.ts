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

function isLossy(source: string): boolean {
  try {
    return checkRoundTrip(source) === 'lossy'
  } catch {
    return true
  }
}

it.fails('finds no lossy input among short token sequences', { timeout: 60_000 }, () => {
  // Fuzz inputs reach blocks the converter warns about; the warnings are not
  // what this test measures.
  const originalWarn = console.warn
  console.warn = () => {}
  const failures: string[] = []
  try {
    let sources = ['']
    for (let length = 1; length <= MAX_TOKENS; length++) {
      sources = sources.flatMap((head) => TOKENS.map((token) => head + token))
      for (const source of sources) {
        if (isLossy(source)) failures.push(source)
      }
    }
  } finally {
    console.warn = originalWarn
  }
  expect(failures.slice(0, 20), `${failures.length} lossy inputs`).toEqual([])
})
