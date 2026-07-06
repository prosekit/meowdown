import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { findText } from '../testing/find-text.ts'
import { setupFixture, traceKeySelection, type Fixture } from '../testing/index.ts'

import type { MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')
const preview = pmRoot.getByTestId('math-preview')
const mathContent = pmRoot.locate('.md-math-view-content')

// An editor showing one paragraph in the given mark mode (caret at `<a>`).
function setup(mode: MarkMode, text: string): Fixture {
  const fixture = setupFixture({ extensionOptions: { markMode: mode } })
  const { n } = fixture
  fixture.set(n.doc(n.paragraph(text)))
  fixture.view.focus()
  return fixture
}

describe('math preview rendering', () => {
  it('renders KaTeX output when the caret is elsewhere in focus mode', async () => {
    using fixture = setup('focus', 'A<a> $E=mc^2$ B')
    void fixture
    await expect.element(preview).toBeVisible()
    await expect.element(preview.locate('.katex')).toBeInTheDocument()
    await expect.element(mathContent).not.toBeVisible()
  })

  it('renders KaTeX output when the caret is elsewhere in hide mode', async () => {
    using fixture = setup('hide', 'A<a> $E=mc^2$ B')
    void fixture
    await expect.element(preview).toBeVisible()
    await expect.element(preview.locate('.katex')).toBeInTheDocument()
    await expect.element(mathContent).not.toBeVisible()
  })

  it('never renders a preview in show mode', async () => {
    using fixture = setup('show', 'A<a> $E=mc^2$ B')
    void fixture
    await expect.element(mathContent).toBeVisible()
    await expect.element(preview).not.toBeVisible()
  })

  it('renders an error for invalid TeX without breaking the editor', async () => {
    using fixture = setup('focus', String.raw`A<a> $\frac{$ B`)
    await expect.element(preview.locate('.katex-error')).toBeInTheDocument()
    await userEvent.keyboard('ok')
    expect(fixture.doc.textContent).toContain('Aok')
  })

  it('re-renders the preview after the formula is edited', async () => {
    using fixture = setup('focus', 'A $x<a>$ B')
    void fixture
    await userEvent.keyboard('y')
    // Leave the unit so the preview shows again, now with the new formula.
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await expect.element(preview).toBeVisible()
    await expect.element(preview.locate('.katex')).toBeInTheDocument()
    await expect.element(preview).toHaveTextContent(/xy/)
  })
})

describe('math source reveal', () => {
  it('reveals the source when the caret is inside, in focus mode', async () => {
    using fixture = setup('focus', 'A $E=<a>mc^2$ B')
    void fixture
    await expect.element(mathContent).toBeVisible()
    await expect.element(preview).not.toBeVisible()
    // The dollars reveal along with the content.
    await expect.element(pmRoot.locate('.md-math-view .md-mark').first()).toBeVisible()
  })

  it('reveals the source when the caret is inside, even in hide mode', async () => {
    using fixture = setup('hide', 'A $E=<a>mc^2$ B')
    void fixture
    await expect.element(mathContent).toBeVisible()
    await expect.element(preview).not.toBeVisible()
    await expect.element(pmRoot.locate('.md-math-view .md-mark').first()).toBeVisible()
  })

  it('reveals at the unit boundary, before the opening dollar', async () => {
    using fixture = setup('focus', 'A B<a> $x$ C')
    void fixture
    await expect.element(preview).toBeVisible()
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(mathContent).toBeVisible()
    await expect.element(preview).not.toBeVisible()
  })

  it('does not reveal bold in hide mode (the math reveal must not leak)', () => {
    using fixture = setup('hide', 'A **<a>bold** B')
    expect(fixture.htmlSnapshot).not.toContain('class="show"')
  })

  it('restores the preview when the caret leaves the unit', async () => {
    using fixture = setup('focus', 'A $x<a>$ B')
    void fixture
    await expect.element(mathContent).toBeVisible()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await expect.element(preview).toBeVisible()
    await expect.element(mathContent).not.toBeVisible()
  })

  it('reveals the source after clicking the preview', async () => {
    using fixture = setup('focus', 'A<a> $E=mc^2$ B')
    void fixture
    await expect.element(preview).toBeVisible()
    await userEvent.click(preview)
    await expect.element(mathContent).toBeVisible()
    await expect.element(preview).not.toBeVisible()
  })
})

describe('math caret behavior', () => {
  it('walks through the revealed source with ArrowRight in focus mode', async () => {
    using fixture = setup('focus', 'A<a> $x$ B')
    expect(await traceKeySelection(fixture, 'ArrowRight', 6)).toMatchInlineSnapshot(`
      [
        "A┃ $x$ B",
        "A ┃$x$ B",
        "A $┃x$ B",
        "A $x┃$ B",
        "A $x$┃ B",
        "A $x$ ┃B",
        "A $x$ B┃",
      ]
    `)
  })

  it('walks through the revealed source with ArrowRight in hide mode', async () => {
    using fixture = setup('hide', 'A<a> $x$ B')
    expect(await traceKeySelection(fixture, 'ArrowRight', 6)).toMatchInlineSnapshot(`
      [
        "A┃ $x$ B",
        "A ⎦$x$ B",
        "A $⎣x$ B",
        "A $x⎦$ B",
        "A $x$⎣ B",
        "A $x$ ┃B",
        "A $x$ B┃",
      ]
    `)
  })

  it('typing at the revealed boundary grows the formula', async () => {
    using fixture = setup('focus', 'A $x<a>$ B')
    await userEvent.keyboard('yz')
    expect(fixture.doc.textContent).toBe('A $xyz$ B')
    const pos = findText(fixture.doc, 'xyz')
    const markNames = fixture.doc
      .nodeAt(pos)
      ?.marks.map((mark) => mark.type.name)
      .sort()
    expect(markNames).toEqual(['mdMath', 'mdPack'])
  })

  it('Backspace at the closing dollar dissolves the unit into plain text', async () => {
    using fixture = setup('hide', 'A $x$<a> B')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.textContent).toBe('A x B')
    const pos = findText(fixture.doc, 'x')
    expect(fixture.doc.nodeAt(pos)?.marks).toEqual([])
  })

  it('undo restores a dissolved unit', async () => {
    using fixture = setup('hide', 'A $x$<a> B')
    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.textContent).toBe('A x B')
    fixture.editor.commands.undo()
    expect(fixture.doc.textContent).toBe('A $x$ B')
    const pos = findText(fixture.doc, 'x')
    const markNames = fixture.doc
      .nodeAt(pos)
      ?.marks.map((mark) => mark.type.name)
      .sort()
    expect(markNames).toEqual(['mdMath', 'mdPack'])
  })
})

describe('math DOM structure', () => {
  it('renders the unit as a mark view with a preview and the source content', () => {
    using fixture = setup('focus', 'A<a> $x$ B')
    expect(fixture.htmlSnapshot).toMatchInlineSnapshot(`
      "
      <p>
        A
        <span
          class="md-pack"
          data-key="math"
        >
          <span class="md-math-view">
            <span
              class="md-math-view-preview"
              contenteditable="false"
              data-testid="math-preview"
            >
            </span>
            <span class="md-math-view-content">
              <span class="md-mark">
                $
              </span>
              x
              <span class="md-mark">
                $
              </span>
            </span>
          </span>
        </span>
        B
      </p>
      "
    `)
  })

  it('nests the reveal decoration inside the mark view when the caret is inside', () => {
    using fixture = setup('focus', 'A $<a>x$ B')
    expect(fixture.htmlSnapshot).toMatchInlineSnapshot(`
      "
      <p>
        A
        <span
          class="md-pack"
          data-key="math"
        >
          <span class="md-math-view">
            <span
              class="md-math-view-preview"
              contenteditable="false"
              data-testid="math-preview"
            >
            </span>
            <span class="md-math-view-content">
              <span class="md-mark">
                <span class="show">
                  $
                </span>
              </span>
              <span class="show">
                x
              </span>
              <span class="md-mark">
                <span class="show">
                  $
                </span>
              </span>
            </span>
          </span>
        </span>
        B
      </p>
      "
    `)
  })
})
