import { describe, expect, it } from 'vitest'

import { hostFromUrl, isLinkableBareHost } from './autolink-tld.ts'

describe('hostFromUrl', () => {
  it('returns the whole string when there is no path', () => {
    expect(hostFromUrl('google.com')).toBe('google.com')
  })

  it('strips the path', () => {
    expect(hostFromUrl('sub.domain.io/path?q=1')).toBe('sub.domain.io')
  })
})

describe('isLinkableBareHost', () => {
  const linkable = [
    'google.com',
    'example.org',
    'sub.domain.io',
    'a-b.example.com',
    'GOOGLE.COM',
    'm.google.com',
  ]
  for (const host of linkable) {
    it(`links ${host}`, () => {
      expect(isLinkableBareHost(host)).toBe(true)
    })
  }

  const rejected = [
    'README.md', // md excluded
    'deploy.sh', // sh excluded
    'main.rs', // rs excluded
    'script.pl', // pl excluded
    'node.js', // js not a tld
    'index.html', // html not a tld
    'file.txt', // txt not a tld
    'Cargo.toml', // toml not a tld
    'package.json', // json not a tld
    'etc', // single label
    't.co', // 1-char host
    'x.io', // 1-char host
    'do.so', // so not a tld and host < 3 anyway
    '1.2.3.4', // last label not a tld
    'v1.2', // last label not a tld
    '192.168.0.1', // last label not a tld
    '-bad.com', // leading hyphen label
    'bad-.com', // trailing hyphen label
  ]
  for (const host of rejected) {
    it(`rejects ${host}`, () => {
      expect(isLinkableBareHost(host)).toBe(false)
    })
  }
})
