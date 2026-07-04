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

describe('virtual caret geometry next to hidden runs (hide mode)', () => {
  it('is visible and full-height right after a hidden closing run', async () => {
    using fixture = setupMode('hide', 'foo **bold**<a> bar')
    void fixture
    await expect.element(caret).toBeVisible()
    const height = Number.parseFloat(getCaretElement().style.height)
    expect(height).toBeGreaterThan(0)
  })

  it('is visible at a unit outer edge at paragraph start', async () => {
    using fixture = setupMode('hide', '<a>**bold** rest')
    void fixture
    await expect.element(caret).toBeVisible()
    const height = Number.parseFloat(getCaretElement().style.height)
    expect(height).toBeGreaterThan(0)
  })

  it('draws the two coincident boundary positions at one x', async () => {
    const measureLeftAt = async (text: string): Promise<number> => {
      using fixture = setupMode('hide', text)
      void fixture
      await expect.element(caret).toBeVisible()
      return Number.parseFloat(getCaretElement().style.left)
    }
    const contentEdge = await measureLeftAt('foo **bold<a>** bar')
    const outerEdge = await measureLeftAt('foo **bold**<a> bar')
    expect(Math.abs(contentEdge - outerEdge)).toBeLessThanOrEqual(1)
  })

  it('is visible inside an empty paragraph', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineMarkMode('hide'))
    fixture.set(n.doc(n.paragraph()))
    fixture.view.focus()
    await expect.element(caret).toBeVisible()
  })
})

describe('virtual caret tails (hide mode)', () => {
  it('shows a right tail after a closing run', async () => {
    using fixture = setupMode('hide', 'foo **bold**<a> bar')
    void fixture
    await expect.element(caret).toHaveAttribute('data-tail', 'right')
  })

  it('shows a left tail before a closing run', async () => {
    using fixture = setupMode('hide', 'foo **bold<a>** bar')
    void fixture
    await expect.element(caret).toHaveAttribute('data-tail', 'left')
  })

  it('shows tails at the opening edges', async () => {
    {
      using fixture = setupMode('hide', 'foo <a>**bold** bar')
      void fixture
      await expect.element(caret).toHaveAttribute('data-tail', 'left')
    }
    {
      using fixture = setupMode('hide', 'foo **<a>bold** bar')
      void fixture
      await expect.element(caret).toHaveAttribute('data-tail', 'right')
    }
  })

  it('shows no tail in plain text', async () => {
    using fixture = setupMode('hide', 'hello <a>world')
    void fixture
    await expect.element(caret).toBeVisible()
    await expect.element(caret).not.toHaveAttribute('data-tail')
  })

  it('shows no tail in focus mode', async () => {
    using fixture = setupMode('focus', 'foo **bold**<a> bar')
    void fixture
    await expect.element(caret).toBeVisible()
    await expect.element(caret).not.toHaveAttribute('data-tail')
  })

  it('flips the tail while arrowing across a boundary', async () => {
    using fixture = setupMode('hide', 'foo **bold** <a>bar')
    void fixture
    await userEvent.keyboard('{ArrowLeft}')
    await expect.element(caret).toHaveAttribute('data-tail', 'right')
    await userEvent.keyboard('{ArrowLeft}')
    await expect.element(caret).toHaveAttribute('data-tail', 'left')
  })
})
