import { describe, expect, it } from 'vitest'

import { defineEditorExtension } from './extension.ts'
import { MARK_NAMES } from './mark-names.ts'

describe('inline-marks', () => {
  it('editor schema mark names match MARK_NAMES exactly', () => {
    const schema = defineEditorExtension().schema!
    const schemaMarkNames = Object.keys(schema.marks).sort()
    expect(schemaMarkNames).toEqual([...MARK_NAMES].sort())
  })

  it('ranks image marks outside the source-styling marks', () => {
    // Mark registration order is the rank order, and a lower rank is the outer
    // DOM wrapper. The image preview (mdImageView) must wrap the source span
    // (mdImageSource), which must wrap the syntax marks, so that hiding the
    // source never hides the preview.
    const schema = defineEditorExtension().schema!
    const order = Object.keys(schema.marks)
    expect(order.indexOf('mdImageView')).toBeLessThan(order.indexOf('mdImageSource'))
    expect(order.indexOf('mdImageSource')).toBeLessThan(order.indexOf('mdMark'))
    expect(order.indexOf('mdImageSource')).toBeLessThan(order.indexOf('mdLinkUri'))
  })
})
