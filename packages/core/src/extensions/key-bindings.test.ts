import { describe, expect, it } from 'vitest'

import { EDITOR_KEY_BINDINGS } from './key-bindings.ts'

describe('EDITOR_KEY_BINDINGS', () => {
  it('lists every formatting and heading shortcut', () => {
    expect(EDITOR_KEY_BINDINGS).toMatchInlineSnapshot(`
      {
        "Mod-1": "Heading 1",
        "Mod-2": "Heading 2",
        "Mod-3": "Heading 3",
        "Mod-4": "Heading 4",
        "Mod-5": "Heading 5",
        "Mod-6": "Heading 6",
        "Mod-Shift-h": "Highlight",
        "Mod-Shift-x": "Strikethrough",
        "Mod-b": "Bold",
        "Mod-e": "Inline code",
        "Mod-i": "Italic",
        "Mod-k": "Link",
      }
    `)
  })
})
