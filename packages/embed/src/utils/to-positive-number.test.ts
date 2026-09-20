import { expect, it } from 'vitest'

import { toPositiveNumber } from './to-positive-number.ts'

it('rounds positive finite numbers', () => {
  expect(toPositiveNumber(12)).toBe(12)
  expect(toPositiveNumber(12.6)).toBe(13)
})

it('rejects everything else', () => {
  expect(toPositiveNumber(0)).toBeUndefined()
  expect(toPositiveNumber(-1)).toBeUndefined()
  expect(toPositiveNumber(NaN)).toBeUndefined()
  expect(toPositiveNumber(Infinity)).toBeUndefined()
  expect(toPositiveNumber('12')).toBeUndefined()
  expect(toPositiveNumber(null)).toBeUndefined()
})
