import { describe, expect, it } from 'vitest'

import { findInlineImages } from './find-inline-images.ts'

describe('findInlineImages', () => {
  it('finds a single image with exact alt, src, and span', () => {
    const text = '![cat](cat.png)'
    expect(findInlineImages(text)).toEqual([
      { from: 0, to: text.length, alt: 'cat', src: 'cat.png' },
    ])
  })

  it('finds an image embedded in surrounding text', () => {
    const text = 'see ![cat](cat.png) here'
    const [image] = findInlineImages(text)
    expect(text.slice(image.from, image.to)).toBe('![cat](cat.png)')
    expect(image.alt).toBe('cat')
    expect(image.src).toBe('cat.png')
  })

  it('finds multiple images in document order', () => {
    const images = findInlineImages('![a](1.png) and ![b](2.png)')
    expect(images.map((image) => image.src)).toEqual(['1.png', '2.png'])
    expect(images.map((image) => image.alt)).toEqual(['a', 'b'])
    expect(images[0].from).toBeLessThan(images[1].from)
  })

  it('handles an empty alt', () => {
    expect(findInlineImages('![](x.png)')).toEqual([{ from: 0, to: 10, alt: '', src: 'x.png' }])
  })

  it('excludes the title, reading only the URL as src', () => {
    const [image] = findInlineImages('![a](b.png "title")')
    expect(image.src).toBe('b.png')
    expect(image.alt).toBe('a')
  })

  it('finds an image nested inside emphasis', () => {
    const [image] = findInlineImages('*see ![a](b.png)*')
    expect(image).toMatchObject({ alt: 'a', src: 'b.png' })
  })

  it('returns the raw label slice when the alt contains markdown', () => {
    const [image] = findInlineImages('![*x*](y.png)')
    expect(image.alt).toBe('*x*')
  })

  it('ignores an image inside inline code', () => {
    expect(findInlineImages('`![a](b.png)`')).toEqual([])
  })

  it('ignores an escaped image', () => {
    expect(findInlineImages(String.raw`\![a](b.png)`)).toEqual([])
  })

  it('ignores a plain link', () => {
    expect(findInlineImages('[a](b.png)')).toEqual([])
  })

  it('ignores a reference-style image', () => {
    expect(findInlineImages('![a][ref]')).toEqual([])
  })

  it('ignores an unclosed image', () => {
    expect(findInlineImages('![unclosed')).toEqual([])
  })

  it('ignores an image with an empty src', () => {
    expect(findInlineImages('![]()')).toEqual([])
  })
})
