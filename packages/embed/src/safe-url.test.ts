import { expect, it } from 'vitest'

import { getSafeUrl } from './safe-url.ts'

it('accepts absolute web URLs', () => {
  expect(getSafeUrl('https://example.com/path?q=value#part')).toBe(
    'https://example.com/path?q=value#part',
  )
  expect(getSafeUrl('http://example.com')).toBe('http://example.com/')
})

it('rejects executable and document-relative destinations', () => {
  expect(getSafeUrl('javascript:alert(1)')).toBeUndefined()
  expect(getSafeUrl('data:text/html,hello')).toBeUndefined()
  expect(getSafeUrl('//example.com')).toBeUndefined()
  expect(getSafeUrl('/relative')).toBeUndefined()
})

it('rejects credentials and control characters', () => {
  expect(getSafeUrl('https://user:password@example.com')).toBeUndefined()
  expect(getSafeUrl('https://example.com/\npath')).toBeUndefined()
})

it('accepts host-approved media protocols without allowing other protocols', () => {
  expect(getSafeUrl('reflect-asset://localhost/1/x-media/123/hash')).toBeUndefined()
  expect(getSafeUrl('reflect-asset://localhost/1/x-media/123/hash', ['reflect-asset:'])).toBe(
    'reflect-asset://localhost/1/x-media/123/hash',
  )
  expect(getSafeUrl('javascript:alert(1)', ['reflect-asset:'])).toBeUndefined()
})
