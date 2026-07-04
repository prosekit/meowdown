import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { findText } from '../testing/find-text.ts'
import { setupFixture, traceKeySelection, type Fixture } from '../testing/index.ts'

import { isHiddenRunInterior } from './hidden-run.ts'
import { defineMarkMode, type MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')

function setupMode(mode: MarkMode, text: string): Fixture {
  const fixture = setupFixture()
  const { editor, n } = fixture
  editor.use(defineMarkMode(mode))
  fixture.set(n.doc(n.paragraph(text)))
  fixture.view.focus()
  return fixture
}

// Click the editor at the viewport point `(x, y)` (a real pointer click, so the
// caret goes through the browser's hit testing and the pointer snap).
async function clickAt(fixture: Fixture, x: number, y: number): Promise<void> {
  const editorRect = fixture.view.dom.getBoundingClientRect()
  await userEvent.click(pmRoot, {
    position: { x: x - editorRect.left, y: y - editorRect.top },
  })
}

describe('hide mode arrow traversal', () => {
  it('ArrowLeft skips a hidden run interior but rests on both edges', async () => {
    using fixture = setupMode('hide', 'foo **bold** <a>bar')
    const steps = await traceKeySelection(fixture, 'ArrowLeft', 3)
    expect(steps).toMatchInlineSnapshot(`
      [
        "foo **bold** ┃bar",
        "foo **bold**┃ bar",
        "foo **bold┃** bar",
        "foo **bol┃d** bar",
      ]
    `)
  })

  it('ArrowRight mirrors the traversal', async () => {
    using fixture = setupMode('hide', 'foo <a>**bold** bar')
    const steps = await traceKeySelection(fixture, 'ArrowRight', 3)
    expect(steps).toMatchInlineSnapshot(`
      [
        "foo ┃**bold** bar",
        "foo **┃bold** bar",
        "foo **b┃old** bar",
        "foo **bo┃ld** bar",
      ]
    `)
  })

  it('ArrowRight crosses the closing run through both edges', async () => {
    using fixture = setupMode('hide', 'foo **bol<a>d** bar')
    const steps = await traceKeySelection(fixture, 'ArrowRight', 3)
    expect(steps).toMatchInlineSnapshot(`
      [
        "foo **bol┃d** bar",
        "foo **bold┃** bar",
        "foo **bold**┃ bar",
        "foo **bold** ┃bar",
      ]
    `)
  })

  it("traverses a link's trailing run in one step", async () => {
    using fixture = setupMode('hide', 'foo [docs](https://a.io) <a>bar')
    const steps = await traceKeySelection(fixture, 'ArrowLeft', 2)
    expect(steps).toMatchInlineSnapshot(`
      [
        "foo [docs](https://a.io) ┃bar",
        "foo [docs](https://a.io)┃ bar",
        "foo [docs┃](https://a.io) bar",
      ]
    `)
  })

  it('adjacent units expose both content edges but not the midpoint', async () => {
    using fixture = setupMode('hide', '**a**_b_<a>')
    const steps = await traceKeySelection(fixture, 'ArrowLeft', 4)
    expect(steps).toMatchInlineSnapshot(`
      [
        "**a**_b_┃",
        "**a**_b┃_",
        "**a**_┃b_",
        "**a┃**_b_",
        "**┃a**_b_",
      ]
    `)
  })

  it('keeps focus and show modes untouched', async () => {
    using fixture = setupMode('focus', 'foo **b<a>old** bar')
    const steps = await traceKeySelection(fixture, 'ArrowLeft', 2)
    expect(steps).toMatchInlineSnapshot(`
      [
        "foo **b┃old** bar",
        "foo **┃bold** bar",
        "foo *┃*bold** bar",
      ]
    `)
  })
})

describe('hide mode pointer snapping', () => {
  it('lands at the unit outer edge when clicking at the left edge of a word', async () => {
    using fixture = setupMode('hide', 'foo **bold** bar')
    const coords = fixture.view.coordsAtPos(findText(fixture.doc, 'bold'), 1)
    await clickAt(fixture, coords.left + 1, (coords.top + coords.bottom) / 2)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo ┃**bold** bar"`)
  })

  it('lands after the unit when clicking at the right edge of a word', async () => {
    using fixture = setupMode('hide', 'foo **bold** bar')
    const coords = fixture.view.coordsAtPos(findText(fixture.doc, 'bold') + 4, -1)
    await clickAt(fixture, coords.right - 1, (coords.top + coords.bottom) / 2)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **bold**┃ bar"`)
  })
})

describe('hide mode selection extension', () => {
  it('Shift+ArrowLeft extends over a hidden run without cutting it', async () => {
    using fixture = setupMode('hide', 'foo **bold** <a>bar')
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **bold**❰ ❱bar"`)
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **bold❰** ❱bar"`)
  })
})

describe('hide mode caret invariants', () => {
  it('vertical motion never rests inside a hidden run', async () => {
    using fixture = setupMode('hide', 'aaaa aaaa aaaa')
    const { n } = fixture
    fixture.set(
      n.doc(n.paragraph('aaaa aaaa <a>aaaa'), n.paragraph('aa **bold** [docs](https://a.io) zz')),
    )
    fixture.view.focus()
    for (const key of ['ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowUp']) {
      await userEvent.keyboard(`{${key}}`)
      expect(isHiddenRunInterior(fixture.state, fixture.state.selection.head)).toBe(false)
    }
  })

  it('snaps a programmatic selection out of a run interior', () => {
    using fixture = setupMode('hide', 'foo **bold** <a>bar')
    const interior = findText(fixture.doc, 'bold') + 5
    fixture.view.dispatch(
      fixture.view.state.tr.setSelection(TextSelection.create(fixture.view.state.doc, interior)),
    )
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **bold┃** bar"`)
  })
})

describe('hide mode Enter relocation', () => {
  it('splits after the unit at the closing content edge', async () => {
    using fixture = setupMode('hide', 'foo **bold<a>** bar')
    await userEvent.keyboard('{Enter}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`
      "
      foo **bold**
      ┃ bar
      "
    `)
  })

  it('splits before the unit at the opening content edge', async () => {
    using fixture = setupMode('hide', 'foo **<a>bold** bar')
    await userEvent.keyboard('{Enter}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`
      "
      foo 
      ┃**bold** bar
      "
    `)
  })

  it('keeps the unit whole when splitting inside a bullet', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineMarkMode('hide'))
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('**<a>foo**'))))
    fixture.view.focus()
    await userEvent.keyboard('{Enter}')
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      "-
      - **foo**
      "
    `)
  })

  it('splits mid-unit in focus mode exactly as before', async () => {
    using fixture = setupMode('focus', '**b<a>old**')
    await userEvent.keyboard('{Enter}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`
      "
      **b
      ┃old**
      "
    `)
  })
})

describe('hide mode typing at coincident positions', () => {
  it('typing at the content edge joins the unit', async () => {
    using fixture = setupMode('hide', 'foo **bold<a>** bar')
    await userEvent.keyboard('x')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **boldx┃** bar"`)
    expect(docToMarkdown(fixture.doc)).toBe('foo **boldx** bar\n')
  })

  it('typing at the outer edge stays plain', async () => {
    using fixture = setupMode('hide', 'foo **bold**<a> bar')
    await userEvent.keyboard('x')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **bold**x┃ bar"`)
    expect(docToMarkdown(fixture.doc)).toBe('foo **bold**x bar\n')
  })
})
