import { describe, expect, it } from 'vitest'

import { defineEditorExtension } from './extension.ts'
import { MARK_NAMES } from './inline-marks.ts'

describe('inline-marks', () => {
  it('editor schema mark names match MARK_NAMES exactly', () => {
    const schema = defineEditorExtension().schema!
    const schemaMarkNames = Object.keys(schema.marks).sort()
    expect(schemaMarkNames).toEqual([...MARK_NAMES].sort())
  })
})
