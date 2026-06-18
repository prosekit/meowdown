import { describe, expect, it } from 'vitest'

import { hostFromUrl, isLinkableBareHost } from './autolink-tld.ts'

describe('hostFromUrl', () => {
  it('returns the whole string when there is no path', () => {
    expect(hostFromUrl('google.com')).toBe('google.com')
  })

  it('strips the path', () => {
    expect(hostFromUrl('sub.domain.com/path?q=1')).toBe('sub.domain.com')
  })
})

describe('isLinkableBareHost', () => {
  const linkable = [
    'google.com',
    'example.org',
    'cdn.example.net',
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
    'page.io', // io is a real TLD but not in the curated list
    'corp.co', // co is a real TLD but excluded on purpose
    'ab.com', // 2-char registrable host (com is in the list)
    'x.org', // 1-char registrable host (org is in the list)
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
