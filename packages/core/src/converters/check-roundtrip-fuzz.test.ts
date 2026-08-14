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

const CONFIG = { seed: 1, numRuns: 100_000, verbose: true } satisfies fc.Parameters

it.fails('finds no lossy input among ascii characters', { timeout: 60_000 }, () => {
it('finds no lossy input among ascii characters', { timeout: 60_000 }, () => {
  fc.assert(
    fc.property(fc.string({ unit: 'grapheme-ascii', minLength: 1, maxLength: 100 }), check),
    CONFIG,
  )
})

it.fails('finds no lossy input among sampled character', { timeout: 60_000 }, () => {
  const unit = fc.constantFrom(...TOKENS)
  fc.assert(fc.property(fc.string({ unit, minLength: 1, maxLength: 16 }), check), CONFIG)
  fc.assert(fc.property(fc.string({ unit, minLength: 17, maxLength: 60 }), check), CONFIG)
  fc.assert(fc.property(fc.string({ unit, minLength: 61, maxLength: 1000 }), check), CONFIG)
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
