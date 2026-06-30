import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { findText } from '../testing/find-text.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineMarkMode, type MarkMode } from './mark-mode.ts'

function setupMode(mode: MarkMode, doc: (fixture: Fixture) => void): Fixture {
  const fixture = setupFixture()
  fixture.editor.use(defineMarkMode(mode))
  doc(fixture)
  fixture.view.focus()
  return fixture
}

function setCaret(fixture: Fixture, pos: number): void {
  const { view } = fixture
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
}

/** Dispatch a real (synthetic) left click at viewport coords, then settle. */
async function clickAtCoords(fixture: Fixture, clientX: number, clientY: number): Promise<void> {
  const target = document.elementFromPoint(clientX, clientY) ?? fixture.view.dom
  const init = { clientX, clientY, bubbles: true, cancelable: true, view: window, button: 0 }
  target.dispatchEvent(new MouseEvent('mousedown', init))
  target.dispatchEvent(new MouseEvent('mouseup', init))
  target.dispatchEvent(new MouseEvent('click', init))
  await new Promise((resolve) => setTimeout(resolve, 15))
}

/** Click at the left edge of the first occurrence of `query`. */
async function clickLeftEdgeOf(fixture: Fixture, query: string): Promise<void> {
  const coords = fixture.view.coordsAtPos(findText(fixture.doc, query))
  await clickAtCoords(fixture, coords.left, (coords.top + coords.bottom) / 2)
}

async function traverse(
  fixture: Fixture,
  start: number,
  key: string,
  times: number,
): Promise<string> {
  setCaret(fixture, start)
  const steps = [fixture.selectionSnapshot]
  for (let index = 0; index < times; index++) {
    await userEvent.keyboard(`{${key}}`)
    steps.push(fixture.selectionSnapshot)
  }
  return steps.join(' -> ')
}

describe('caret-marker-snap (hide mode)', () => {
  it('a click left of "foo" then Enter keeps the bold intact', async () => {
    using fixture = setupMode('hide', (f) => f.set(f.n.doc(f.n.paragraph('**foo**'))))
    await clickLeftEdgeOf(fixture, 'foo')
    await userEvent.keyboard('{Enter}')
    expect(docToMarkdown(fixture.doc)).toBe('\n**foo**\n')
  })

  // KNOWN FAILING (display:none DOM-caret ambiguity): the click snaps the model
  // selection to pos 1 (verified), but Space/typing go through the browser's DOM
  // insertion, which resolves the zero-width hidden `**` to pos 3 anyway. Enter
  // works because it uses the model selection (the Enter keymap); text input does not.
  it('a click left of "foo" then Space inserts outside the bold', async () => {
    using fixture = setupMode('hide', (f) => f.set(f.n.doc(f.n.paragraph('**foo**'))))
    await clickLeftEdgeOf(fixture, 'foo')
    await userEvent.keyboard(' ')
    expect(docToMarkdown(fixture.doc)).toBe(' **foo**\n')
  })

  // KNOWN FAILING (same display:none DOM-caret ambiguity as the Space case above).
  it('a click left of "foo" then typing inserts outside the bold', async () => {
    using fixture = setupMode('hide', (f) => f.set(f.n.doc(f.n.paragraph('**foo**'))))
    await clickLeftEdgeOf(fixture, 'foo')
    await userEvent.keyboard('x')
    expect(docToMarkdown(fixture.doc)).toBe('x**foo**\n')
  })

  it('ArrowLeft into the opening run then Enter keeps the bold intact', async () => {
    using fixture = setupMode('hide', (f) => f.set(f.n.doc(f.n.paragraph('**bold**'))))
    setCaret(fixture, findText(fixture.doc, 'bold') + 1) // after "b"
    await userEvent.keyboard('{ArrowLeft}')
    await userEvent.keyboard('{Enter}')
    expect(docToMarkdown(fixture.doc)).toBe('\n**bold**\n')
  })

  // DOCUMENTS CURRENT BEHAVIOR (a known limitation): in hide mode the browser
  // already skips the display:none markers natively, but it gets STUCK at the
  // content edge - ArrowRight stops at pos 6 (before the hidden closing `**`) and
  // never reaches pos 8. No selection change fires there, so appendTransaction
  // cannot nudge it across. Ideal would reach the unit's outer edge.
  it('hide-mode arrow nav stops at the content edge (known limitation)', async () => {
    using fixture = setupMode('hide', (f) => f.set(f.n.doc(f.n.paragraph('**foo**'))))
    expect(await traverse(fixture, 1, 'ArrowRight', 6)).toMatchInlineSnapshot(
      `"┃**foo** -> **f┃oo** -> **fo┃o** -> **foo┃** -> **foo┃** -> **foo┃** -> **foo┃**"`,
    )
    expect(await traverse(fixture, 8, 'ArrowLeft', 6)).toMatchInlineSnapshot(
      `"**foo**┃ -> **fo┃o** -> **f┃oo** -> **┃foo** -> **┃foo** -> **┃foo** -> **┃foo**"`,
    )
  })

  // DOCUMENTS CURRENT BEHAVIOR: the caret reaches the single character (after "a")
  // and the unit's left edge, so `**a**` is no longer skipped as an atom.
  it('a single-character bold **a** is reachable by the caret', async () => {
    using fixture = setupMode('hide', (f) => f.set(f.n.doc(f.n.paragraph('**a**'))))
    expect(await traverse(fixture, 1, 'ArrowRight', 4)).toMatchInlineSnapshot(
      `"┃**a** -> **a┃** -> **a┃** -> **a┃** -> **a┃**"`,
    )
  })

  it('Enter before "a" in **a** keeps the bold and adds an empty paragraph', async () => {
    using fixture = setupMode('hide', (f) => f.set(f.n.doc(f.n.paragraph('**a**'))))
    setCaret(fixture, findText(fixture.doc, 'a')) // content edge before "a"
    await userEvent.keyboard('{Enter}')
    expect(docToMarkdown(fixture.doc)).toBe('\n**a**\n')
  })

  it('Enter after "a" in **a** keeps the bold and adds an empty paragraph', async () => {
    using fixture = setupMode('hide', (f) => f.set(f.n.doc(f.n.paragraph('**a**'))))
    setCaret(fixture, findText(fixture.doc, 'a') + 1) // content edge after "a"
    await userEvent.keyboard('{Enter}')
    expect(docToMarkdown(fixture.doc)).toBe('**a**\n')
  })

  it('a click left of "foo" inside a bullet then Enter keeps the bold intact', async () => {
    using fixture = setupMode('hide', (f) =>
      f.set(f.n.doc(f.n.list({ kind: 'bullet' }, f.n.paragraph('**foo**')))),
    )
    await clickLeftEdgeOf(fixture, 'foo')
    await userEvent.keyboard('{Enter}')
    expect(docToMarkdown(fixture.doc)).toBe('-\n- **foo**\n')
  })

  it('Enter before "foo" in nested ***foo*** keeps the whole unit intact', async () => {
    using fixture = setupMode('hide', (f) => f.set(f.n.doc(f.n.paragraph('***foo***'))))
    setCaret(fixture, findText(fixture.doc, 'foo'))
    await userEvent.keyboard('{Enter}')
    expect(docToMarkdown(fixture.doc)).toBe('\n***foo***\n')
  })

  // KNOWN FAILING (hide-mode click hit-testing on a link is unreliable): the
  // synthetic click on the link text lands at the paragraph start, not the link
  // edge, so the empty line is inserted before "x" instead of before the link.
  // The zone/snap logic itself handles a link's `](url)` tail (see unitInfoAt's
  // hidden-mark walk); it is the click landing that is off here.
  it('a click left of a link text then Enter keeps the link intact', async () => {
    using fixture = setupMode('hide', (f) =>
      f.set(f.n.doc(f.n.paragraph('x [docs](http://example.test) y'))),
    )
    await clickLeftEdgeOf(fixture, 'docs')
    await userEvent.keyboard('{Enter}')
    expect(docToMarkdown(fixture.doc)).toBe('x \n[docs](http://example.test) y\n')
  })
})

describe('caret-marker-snap (inert outside hide mode)', () => {
  it('focus mode is unchanged: Enter at a revealed marker splits as before', async () => {
    using fixture = setupMode('focus', (f) => f.set(f.n.doc(f.n.paragraph('**bold**'))))
    setCaret(fixture, findText(fixture.doc, 'bold')) // between the revealed ** and "bold"
    await userEvent.keyboard('{Enter}')
    expect(docToMarkdown(fixture.doc)).toBe('**\n\nbold**\n')
  })

  it('show mode is unchanged: Enter at the marker boundary splits as before', async () => {
    using fixture = setupMode('show', (f) => f.set(f.n.doc(f.n.paragraph('**bold**'))))
    setCaret(fixture, findText(fixture.doc, 'bold'))
    await userEvent.keyboard('{Enter}')
    expect(docToMarkdown(fixture.doc)).toBe('**\n\nbold**\n')
  })
})
