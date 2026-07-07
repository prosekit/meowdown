import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { findText } from '../testing/find-text.ts'
import { setupFixture, traceKeySelection, type Fixture } from '../testing/index.ts'

import { isHiddenRunInterior } from './hidden-run.ts'
import type { MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')

function setupMode(mode: MarkMode, text: string): Fixture {
  const fixture = setupFixture({ extensionOptions: { markMode: mode } })
  const { n } = fixture
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
        "foo **bold**⎣ bar",
        "foo **bold⎦** bar",
        "foo **bol┃d** bar",
      ]
    `)
  })

  it('ArrowRight mirrors the traversal', async () => {
    using fixture = setupMode('hide', 'foo <a>**bold** bar')
    const steps = await traceKeySelection(fixture, 'ArrowRight', 3)
    expect(steps).toMatchInlineSnapshot(`
      [
        "foo ⎦**bold** bar",
        "foo **⎣bold** bar",
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
        "foo **bold⎦** bar",
        "foo **bold**⎣ bar",
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
        "foo [docs](https://a.io)⎣ bar",
        "foo [docs⎦](https://a.io) bar",
      ]
    `)
  })

  it('adjacent units expose both content edges but not the midpoint', async () => {
    using fixture = setupMode('hide', '**a**_b_<a>')
    const steps = await traceKeySelection(fixture, 'ArrowLeft', 4)
    expect(steps).toMatchInlineSnapshot(`
      [
        "**a**_b_⎣",
        "**a**_b⎦_",
        "**a**_⎣b_",
        "**a⎦**_b_",
        "**⎣a**_b_",
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
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo ⎦**bold** bar"`)
  })

  it('lands after the unit when clicking at the right edge of a word', async () => {
    using fixture = setupMode('hide', 'foo **bold** bar')
    const coords = fixture.view.coordsAtPos(findText(fixture.doc, 'bold') + 4, -1)
    await clickAt(fixture, coords.right - 1, (coords.top + coords.bottom) / 2)
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **bold**⎣ bar"`)
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
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **bold⎦** bar"`)
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
      ⎦**bold** bar
      "
    `)
  })

  it('keeps the unit whole when splitting inside a bullet', async () => {
    using fixture = setupFixture({ extensionOptions: { markMode: 'hide' } })
    const { n } = fixture
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

describe('hide mode unformat deletion', () => {
  it('Backspace after a unit dissolves it', async () => {
    using fixture = setupMode('hide', 'foo **bold**<a> bar')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo bold┃ bar"`)
    expect(docToMarkdown(fixture.doc)).toBe('foo bold bar\n')
  })

  it('Backspace at the content edge deletes a content char', async () => {
    using fixture = setupMode('hide', 'foo **bold<a>** bar')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **bol⎦** bar"`)
    expect(docToMarkdown(fixture.doc)).toBe('foo **bol** bar\n')
  })

  it('Delete at the content edge dissolves the unit', async () => {
    using fixture = setupMode('hide', 'foo **bold<a>** bar')
    await userEvent.keyboard('{Delete}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo bold┃ bar"`)
  })

  it('Delete before a unit dissolves it', async () => {
    using fixture = setupMode('hide', 'foo <a>**bold** bar')
    await userEvent.keyboard('{Delete}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo ┃bold bar"`)
  })

  it('Backspace after a link dissolves the whole link in one undo step', async () => {
    using fixture = setupMode('hide', 'foo [docs](https://a.io)<a> bar')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo docs┃ bar"`)
    fixture.editor.commands.undo()
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo [docs](https://a.io)⎣ bar"`)
  })

  it("Backspace at a link's content start dissolves the link", async () => {
    using fixture = setupMode('hide', 'foo [<a>docs](https://a.io) bar')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo ┃docs bar"`)
  })

  it('dissolving an inner unit keeps the outer unit', async () => {
    using fixture = setupMode('hide', '**a *b*<a> c**')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"**a b┃ c**"`)
    expect(docToMarkdown(fixture.doc)).toBe('**a b c**\n')
  })

  it('dissolving a triple run removes both nested units', async () => {
    using fixture = setupMode('hide', '***x***<a>')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"x┃"`)
  })

  it('a merged run dissolves only the adjacent unit', async () => {
    using fixture = setupMode('hide', '**a**_<a>b_')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"**a**⎣b"`)
    expect(docToMarkdown(fixture.doc)).toBe('**a**b\n')
  })

  it('a degenerate literal link deletes one character', async () => {
    using fixture = setupMode('hide', 'x[](https://a.io)<a>y')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"x[](https://a.io┃y"`)
  })

  it('atom deletion stays with atom navigation at a shared boundary', async () => {
    using fixture = setupMode('hide', '**bold**[[note]]<a>')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"**bold**⎣"`)
  })

  it('unformat wins over atom one-char deletion at a shared boundary', async () => {
    using fixture = setupMode('hide', '**bold**<a>[[note]]')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"bold┃[[note]]"`)
  })

  it('a range selection still deletes natively', async () => {
    using fixture = setupMode('hide', 'foo **bold** <a>bar')
    await userEvent.keyboard('{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **bold❰** ❱bar"`)
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **bold┃bar"`)
  })

  it('keeps the per-char deletion in focus mode', async () => {
    using fixture = setupMode('focus', 'foo **bold**<a> bar')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **bold*┃ bar"`)
  })
})

describe('hide mode complex cases', () => {
  it('treats a link title as part of the hidden tail', async () => {
    // The space between the url and the title carries no hidden mark (it
    // renders visible in hide mode today, a pre-existing parser quirk), so the
    // tail is two runs with a rest position between them.
    using fixture = setupMode('hide', 'foo [docs](https://a.io "hi") <a>bar')
    const steps = await traceKeySelection(fixture, 'ArrowLeft', 3)
    expect(steps).toMatchInlineSnapshot(`
      [
        "foo [docs](https://a.io "hi") ┃bar",
        "foo [docs](https://a.io "hi")⎣ bar",
        "foo [docs](https://a.io ⎦"hi") bar",
        "foo [docs](https://a.io⎣ "hi") bar",
      ]
    `)
  })

  it('Enter never orphans link markers', async () => {
    using fixture = setupMode('hide', 'foo [docs<a>](https://a.io) bar')
    await userEvent.keyboard('{Enter}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`
      "
      foo [docs](https://a.io)
      ┃ bar
      "
    `)
  })

  it('clicking into the link text keeps typing inside the link', async () => {
    using fixture = setupMode('hide', 'foo [docs](https://a.io) bar')
    const boundary = findText(fixture.doc, 'docs') + 2
    const coords = fixture.view.coordsAtPos(boundary, -1)
    await clickAt(fixture, coords.left, (coords.top + coords.bottom) / 2)
    await userEvent.keyboard('x')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo [dox┃cs](https://a.io) bar"`)
  })

  it('traverses a triple marker as one run per side', async () => {
    using fixture = setupMode('hide', '***x***<a>')
    const steps = await traceKeySelection(fixture, 'ArrowLeft', 3)
    expect(steps).toMatchInlineSnapshot(`
      [
        "***x***⎣",
        "***x⎦***",
        "***⎣x***",
        "⎦***x***",
      ]
    `)
  })

  it('Enter at an inner content edge relocates to the inner unit edge', async () => {
    using fixture = setupMode('hide', '**a *b<a>* c**')
    await userEvent.keyboard('{Enter}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`
      "
      **a *b*
      ┃ c**
      "
    `)
  })

  it('steps through a tag character by character', async () => {
    using fixture = setupMode('hide', 'a #tag <a>b')
    const steps = await traceKeySelection(fixture, 'ArrowLeft', 3)
    expect(steps).toMatchInlineSnapshot(`
      [
        "a #tag ┃b",
        "a #tag┃ b",
        "a #ta┃g b",
        "a #t┃ag b",
      ]
    `)
  })

  it('steps through a bare autolink character by character', async () => {
    using fixture = setupMode('hide', 'see https://a.io<a> end')
    const steps = await traceKeySelection(fixture, 'ArrowLeft', 2)
    expect(steps).toMatchInlineSnapshot(`
      [
        "see https://a.io┃ end",
        "see https://a.i┃o end",
        "see https://a.┃io end",
      ]
    `)
  })

  it('leaves code blocks untouched', async () => {
    using fixture = setupFixture({ extensionOptions: { markMode: 'hide' } })
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock('**fo<a>o**')))
    fixture.view.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"**f┃oo**"`)
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"**┃oo**"`)
  })

  it('dissolves inline code like bold', async () => {
    using fixture = setupMode('hide', 'run `ls`<a> now')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"run ls┃ now"`)
  })

  it('dissolves highlight and strikethrough like bold', async () => {
    {
      using fixture = setupMode('hide', '==x==<a>')
      await userEvent.keyboard('{Backspace}')
      expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"x┃"`)
    }
    {
      using fixture = setupMode('hide', '~~x~~<a>')
      await userEvent.keyboard('{Backspace}')
      expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"x┃"`)
    }
  })

  it('keeps a unit alone in a paragraph fully reachable', async () => {
    using fixture = setupMode('hide', '**bold**<a>')
    const steps = await traceKeySelection(fixture, 'ArrowLeft', 3)
    expect(steps).toMatchInlineSnapshot(`
      [
        "**bold**⎣",
        "**bold⎦**",
        "**bol┃d**",
        "**bo┃ld**",
      ]
    `)
  })

  it('Backspace at paragraph start joins across a trailing unit', async () => {
    using fixture = setupFixture({ extensionOptions: { markMode: 'hide' } })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo **bold**'), n.paragraph('<a>bar')))
    fixture.view.focus()
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **bold**⎣bar"`)
  })

  it('keeps the caret on a rest position after native word deletion', async () => {
    // Native word deletion is engine- and platform-defined: macOS Chromium
    // deletes the space plus the closing markers, Firefox the whole word plus
    // markers, and Linux binds the shortcut to Ctrl instead of Alt. The exact
    // deletion is deliberately unspecified; the snap invariant must hold
    // everywhere (the reparse turns any orphaned markers into literal text).
    using fixture = setupMode('hide', 'foo **bold** <a>bar')
    await userEvent.keyboard('{Alt>}{Backspace}{/Alt}')
    await userEvent.keyboard('{Control>}{Backspace}{/Control}')
    expect(isHiddenRunInterior(fixture.state, fixture.state.selection.head)).toBe(false)
  })
})

describe('hide mode typing at coincident positions', () => {
  it('typing at the content edge joins the unit', async () => {
    using fixture = setupMode('hide', 'foo **bold<a>** bar')
    await userEvent.keyboard('x')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **boldx⎦** bar"`)
    expect(docToMarkdown(fixture.doc)).toBe('foo **boldx** bar\n')
  })

  it('typing at the outer edge stays plain', async () => {
    using fixture = setupMode('hide', 'foo **bold**<a> bar')
    await userEvent.keyboard('x')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"foo **bold**x┃ bar"`)
    expect(docToMarkdown(fixture.doc)).toBe('foo **bold**x bar\n')
  })
})
