import { describe, expect, it } from 'vitest'

import { formatSizedWikiEmbed, parseWikiEmbed, wikiEmbedBasename } from './wiki-embed.ts'

describe('parseWikiEmbed', () => {
  it('parses a plain target', () => {
    expect(parseWikiEmbed('![[Projects/Plan.md]]')).toEqual({
      target: 'Projects/Plan.md',
      display: '',
      width: null,
      height: null,
    })
  })

  it('parses an alias', () => {
    expect(parseWikiEmbed('![[Projects/Plan|Launch plan]]')).toEqual({
      target: 'Projects/Plan',
      display: 'Launch plan',
      width: null,
      height: null,
    })
  })

  it('parses width-only sizing', () => {
    expect(parseWikiEmbed('![[assets/photo.png|320]]')).toEqual({
      target: 'assets/photo.png',
      display: '',
      width: 320,
      height: null,
    })
  })

  it('parses width and height sizing', () => {
    expect(parseWikiEmbed('![[assets/photo.png|320x180]]')).toEqual({
      target: 'assets/photo.png',
      display: '',
      width: 320,
      height: 180,
    })
  })

  it('treats invalid and zero sizes as aliases', () => {
    expect(parseWikiEmbed('![[photo.png|0x20]]').display).toBe('0x20')
    expect(parseWikiEmbed('![[photo.png|20x]]').display).toBe('20x')
  })
})

it('formats a persisted image size', () => {
  expect(formatSizedWikiEmbed('assets/photo.png', 319.6, 179.5)).toBe(
    '![[assets/photo.png|320x180]]',
  )
})

it('gets a decoded basename without a heading fragment', () => {
  expect(wikiEmbedBasename('assets/My%20Photo.png#crop')).toBe('My Photo.png')
})
