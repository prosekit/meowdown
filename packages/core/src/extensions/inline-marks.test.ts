import { describe, expect, it } from 'vitest'

import { defineEditorExtension } from './extension.ts'
import { MARK_NAMES } from './mark-names.ts'

describe('inline-marks', () => {
  it('editor schema mark names match MARK_NAMES exactly', () => {
    const schema = defineEditorExtension().schema!
    const schemaMarkNames = Object.keys(schema.marks).sort()
    expect(schemaMarkNames).toEqual([...MARK_NAMES].sort())
  })

  it('ranks the pack mark outermost of all, so it wraps the whole unit', () => {
    // mdPack must be the outer DOM wrapper, including outside an image mark view,
    // so a reveal range can cover the entire unit.
    const schema = defineEditorExtension().schema!
    const order = Object.keys(schema.marks)
    expect(order.indexOf('mdPack')).toBeLessThan(order.indexOf('mdImage'))
  })
})
