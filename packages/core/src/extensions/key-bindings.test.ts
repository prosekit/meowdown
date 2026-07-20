import { describe, expect, it } from 'vitest'

import { EDITOR_KEY_BINDINGS } from './key-bindings.ts'

describe('EDITOR_KEY_BINDINGS', () => {
  it('lists every formatting and heading shortcut', () => {
    expect(EDITOR_KEY_BINDINGS).toMatchInlineSnapshot(`
      {
        "Alt-ArrowDown": "Move the block or list item down",
        "Alt-ArrowUp": "Move the block or list item up",
        "Escape": "Collapse the selection",
        "Meta-ArrowDown": "Move the caret to the document end",
        "Meta-ArrowUp": "Move the caret to the document start",
        "Mod-.": "Fold or unfold a bullet",
        "Mod-1": "Heading 1",
        "Mod-2": "Heading 2",
        "Mod-3": "Heading 3",
        "Mod-4": "Heading 4",
        "Mod-5": "Heading 5",
        "Mod-6": "Heading 6",
        "Mod-Enter": "Follow the link under the caret, or cycle a checkbox task",
        "Mod-Shift-7": "Ordered list",
        "Mod-Shift-8": "Bullet list",
        "Mod-Shift-9": "Checkbox task list",
        "Mod-Shift-Enter": "Cycle a circle checkbox task",
        "Mod-Shift-h": "Highlight",
        "Mod-Shift-k": "Insert a wikilink",
        "Mod-Shift-v": "Paste without formatting",
        "Mod-Shift-x": "Strikethrough",
        "Mod-b": "Bold",
        "Mod-e": "Inline code",
        "Mod-i": "Italic",
        "Mod-k": "Link",
        "Shift-Meta-ArrowDown": "Select to the document end",
        "Shift-Meta-ArrowUp": "Select to the document start",
      }
    `)
  })
})
