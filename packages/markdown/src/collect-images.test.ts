import { describe, expect, it } from 'vitest'

import { collectImages } from './collect-images.ts'

describe('collectImages', () => {
  it('returns inline image destinations in document order', () => {
    expect(collectImages('![a](one.png) text\n\n> - ![b](<two.png> "title")')).toEqual([
      'one.png',
      '<two.png>',
    ])
  })

  it('skips autolinks inside an image label', () => {
    expect(collectImages('![see https://example.com](cat.png)')).toEqual(['cat.png'])
  })

  it('skips reference images and code', () => {
    expect(collectImages('![a][ref]\n\n[ref]: cat.png\n\n`![b](dog.png)`')).toEqual([])
  })
})
