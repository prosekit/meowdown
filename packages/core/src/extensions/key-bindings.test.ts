import { describe, expect, it } from 'vitest'

import { EDITOR_KEY_BINDINGS } from './key-bindings.ts'

describe('EDITOR_KEY_BINDINGS', () => {
  it('lists every formatting and heading shortcut', () => {
    expect(EDITOR_KEY_BINDINGS).toMatchInlineSnapshot(`
      {
        "Alt-ArrowDown": "Move the block or list item down",
        "Alt-ArrowUp": "Move the block or list item up",
        "Escape": "Collapse the selection",
        "Mod-.": "Fold or unfold a bullet",
        "Mod-Alt-1": "Heading 1",
        "Mod-Alt-2": "Heading 2",
        "Mod-Alt-3": "Heading 3",
        "Mod-Alt-4": "Heading 4",
        "Mod-Alt-5": "Heading 5",
        "Mod-Alt-6": "Heading 6",
        "Mod-ArrowDown": "Move the caret to the document end",
        "Mod-ArrowUp": "Move the caret to the document start",
        "Mod-Enter": "Follow the link under the caret, or cycle a checkbox task",
        "Mod-Shift-7": "Ordered list",
        "Mod-Shift-8": "Bullet list",
        "Mod-Shift-9": "Checkbox task list",
        "Mod-Shift-ArrowDown": "Select to the document end",
        "Mod-Shift-ArrowUp": "Select to the document start",
        "Mod-Shift-Enter": "Cycle a circle checkbox task",
        "Mod-Shift-h": "Highlight",
        "Mod-Shift-k": "Insert a wikilink",
        "Mod-Shift-x": "Strikethrough",
        "Mod-b": "Bold",
        "Mod-e": "Inline code",
        "Mod-i": "Italic",
        "Mod-k": "Link",
        "Shift-Enter": "Insert a line break, or leave a code block from its end",
      }
    `)
  })
})
