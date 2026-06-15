import { describe, expect, it } from 'vitest'

import { scanInlineImages } from './scan-inline-images.ts'

describe('scanInlineImages', () => {
  it('finds an image', () => {
    const images = scanInlineImages('see ![alt](http://x/p.png) end')
    expect(images).toHaveLength(1)
    expect(images[0]).toMatchObject({ alt: 'alt', src: 'http://x/p.png' })
  })

  it('finds multiple images', () => {
    expect(scanInlineImages('![a](1.png) and ![b](2.png)')).toHaveLength(2)
  })

  it('handles an empty alt', () => {
    expect(scanInlineImages('![](z.png)')[0]).toMatchObject({ alt: '', src: 'z.png' })
  })

  it('ignores images inside inline code', () => {
    expect(scanInlineImages('`![x](y.png)`')).toHaveLength(0)
  })

  it('finds nothing in plain text', () => {
    expect(scanInlineImages('just words here')).toHaveLength(0)
  })
})
