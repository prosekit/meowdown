import { describe, expect, it } from 'vitest'

import { COMMON_TLDS, extractTld, hasAllowedTld } from './common-tlds.ts'

describe('extractTld', () => {
  it.each([
    ['https://example.com', 'com'],
    ['http://example.com', 'com'],
    ['www.example.com', 'com'],
    ['me@example.com', 'com'],
    ['mailto:me@example.com', 'com'],
    ['xmpp:user@host.org', 'org'],
    ['https://a.b.example.co.uk', 'uk'],
    ['https://example.com:8080', 'com'],
    ['https://example.com/a/b?x=1#y', 'com'],
    ['https://user:pass@example.com', 'com'],
    ['first.last@mail.example.com', 'com'],
    ['https://EXAMPLE.COM', 'com'],
    ['https://example.рф', 'рф'],
    ['https://example.com.', 'com'],
    ['http://192.168.1.1', '1'],
  ])('extracts the TLD of %s as %s', (input, expected) => {
    expect(extractTld(input)).toBe(expected)
  })

  it.each([['https://localhost'], ['mailto:foo'], ['nodots']])(
    'returns undefined for %s (no dotted host)',
    (input) => {
      expect(extractTld(input)).toBeUndefined()
    },
  )
})

describe('hasAllowedTld', () => {
  it.each([
    'https://example.com',
    'https://example.org',
    'https://example.io',
    'https://example.co',
    'https://a.example.co.uk',
    'https://example.dev',
    'https://example.app',
    'https://example.xyz',
    'https://example.рф',
    'me@example.com',
  ])('allows %s', (input) => {
    expect(hasAllowedTld(input)).toBe(true)
  })

  it.each([
    'https://example.zzz',
    'https://example.invalidtld',
    'https://example.museum',
    'https://example.guru',
    'https://example.ninja',
    'https://example.123',
    'http://192.168.1.1',
    'https://example.c',
    'https://localhost',
  ])('rejects %s', (input) => {
    expect(hasAllowedTld(input)).toBe(false)
  })
})

describe('COMMON_TLDS', () => {
  it('contains representative common TLDs', () => {
    for (const tld of ['com', 'net', 'org', 'io', 'uk', 'co', 'om', 'qa', 'dev', 'рф']) {
      expect(COMMON_TLDS.has(tld)).toBe(true)
    }
  })

  it('excludes uncommon and invalid TLDs', () => {
    for (const tld of ['zzz', 'museum', 'guru', 'invalidtld', '123']) {
      expect(COMMON_TLDS.has(tld)).toBe(false)
    }
  })

  it('pins the set size', () => {
    expect(COMMON_TLDS.size).toMatchInlineSnapshot(`288`)
  })
})
