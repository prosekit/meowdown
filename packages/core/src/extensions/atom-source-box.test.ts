import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import type { MarkMode } from './mark-mode.ts'

const SOURCE = '[[Cat care basics]]'

function setup(mode: MarkMode): Fixture {
  const fixture = setupFixture({ extensionOptions: { markMode: mode } })
  const { n } = fixture
  fixture.set(
    n.doc(n.list({ kind: 'bullet' }, n.paragraph(SOURCE)), n.paragraph('plain trailing paragraph')),
  )
  fixture.view.focus()
  return fixture
}

function dropCaret(fixture: Fixture, pos: number): void {
  fixture.view.dispatch(fixture.state.tr.setSelection(TextSelection.create(fixture.doc, pos)))
}

function sourceTextNode(fixture: Fixture): Text {
  const el = fixture.dom.querySelector('.md-atom-view-content')!
  return el.firstChild as Text
}

const ALL_MODES: MarkMode[] = ['hide', 'focus', 'show']

// iOS WebKit only anchors the DOM selection at positions whose text has
// inline box geometry (`RenderText::containsCaretOffset`); a geometryless
// anchor gets relocated every frame, fighting prosemirror-view's rewrite.
// These are the two halves of the fix's contract: the hidden source has
// geometry, and that geometry still occupies no layout space.
describe.each(ALL_MODES)('atom source box in %s mode', (mode) => {
  it('gives every source text position caret geometry', () => {
    using fixture = setup(mode)
    const text = sourceTextNode(fixture)
    for (const offset of [0, Math.floor(SOURCE.length / 2), SOURCE.length]) {
      const range = document.createRange()
      range.setStart(text, offset)
      range.collapse(true)
      const rects = Array.from(range.getClientRects()).filter((rect) => rect.height > 0)
      expect(rects.length, `offset ${offset}`).toBeGreaterThan(0)
    }
  })

  it('keeps the source box at zero width', () => {
    using fixture = setup(mode)
    const box = fixture.dom.querySelector('.md-atom-view-content')!
    expect(box.getBoundingClientRect().width).toBe(0)
  })

  it('keeps the DOM anchor inside the source and PM does not fight it', () => {
    using fixture = setup(mode)
    dropCaret(fixture, findText(fixture.doc, SOURCE))
    const sel = document.getSelection()!
    const el =
      sel.anchorNode!.nodeType === Node.TEXT_NODE
        ? sel.anchorNode!.parentElement!
        : (sel.anchorNode as Element)
    expect(el.closest('.md-atom-view-content')).not.toBeNull()
    expect(getComputedStyle(el).fontSize).not.toBe('0px')
  })

  it('still draws the virtual caret at the label edge', async () => {
    using fixture = setup(mode)
    dropCaret(fixture, findText(fixture.doc, SOURCE) + SOURCE.length)
    await new Promise((resolve) => queueMicrotask(() => resolve(undefined)))
    const caret = document.querySelector<HTMLElement>('[data-testid="virtual-caret"]')!
    const label = fixture.dom.querySelector('.md-atom-view-preview')!
    const caretRect = caret.getBoundingClientRect()
    const labelRect = label.getBoundingClientRect()
    expect(Math.abs(caretRect.left - labelRect.right)).toBeLessThan(2)
    expect(caretRect.height).toBeGreaterThan(10)
  })
})
