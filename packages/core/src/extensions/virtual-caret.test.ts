import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineMarkMode, type MarkMode } from './mark-mode.ts'

const caret = page.getByTestId('virtual-caret')

function setupMode(mode: MarkMode | undefined, text: string): Fixture {
  const fixture = setupFixture()
  const { editor, n } = fixture
  if (mode != null) editor.use(defineMarkMode(mode))
  fixture.set(n.doc(n.paragraph(text)))
  fixture.view.focus()
  return fixture
}

function getCaretElement(): HTMLElement {
  return caret.element() as HTMLElement
}

describe('virtual caret rendering', () => {
  it('draws a visible caret with a height when focused', async () => {
    using fixture = setupMode('hide', 'hello <a>world')
    void fixture
    await expect.element(caret).toBeVisible()
    const height = Number.parseFloat(getCaretElement().style.height)
    expect(height).toBeGreaterThan(0)
  })

  it('draws in every mark mode and without a mode', async () => {
    for (const mode of ['hide', 'focus', 'show', undefined] as const) {
      using fixture = setupMode(mode, 'hello <a>world')
      void fixture
      await expect.element(caret).toBeVisible()
    }
  })

  it('hides the caret when the editor is blurred', async () => {
    using fixture = setupMode('hide', 'hello <a>world')
    await expect.element(caret).toBeVisible()
    fixture.view.dom.blur()
    await expect.element(caret).not.toBeVisible()
  })

  it('hides the caret for a range selection', async () => {
    using fixture = setupMode('hide', 'hello <a>world')
    void fixture
    await expect.element(caret).toBeVisible()
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
    await expect.element(caret).not.toBeVisible()
  })

  it('hides the caret when an atom is selected', async () => {
    using fixture = setupMode('hide', 'a<a>[[note]]b')
    void fixture
    await expect.element(caret).toBeVisible()
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(caret).not.toBeVisible()
  })

  it('restarts the blink animation on caret movement', async () => {
    using fixture = setupMode('hide', 'hello <a>world')
    void fixture
    await expect.element(caret).toBeVisible()
    const before = getCaretElement().style.animationName
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(caret).toBeVisible()
    const after = getCaretElement().style.animationName
    expect(after).not.toBe(before)
  })

  it('follows the selection horizontally', async () => {
    using fixture = setupMode('hide', '<a>hello world')
    void fixture
    await expect.element(caret).toBeVisible()
    const start = Number.parseFloat(getCaretElement().style.left)
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    await expect.element(caret).toBeVisible()
    const moved = Number.parseFloat(getCaretElement().style.left)
    expect(moved).toBeGreaterThan(start)
  })

  it('keeps typing working with the transparent native caret', async () => {
    using fixture = setupMode('hide', 'hello <a>world')
    await userEvent.keyboard('x')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"hello x┃world"`)
  })
})
