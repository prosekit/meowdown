import { Selection } from '@prosekit/pm/state'
import { describe, expect, it, onTestFinished } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineFileView } from './file-view.ts'
import type { MarkMode } from './mark-mode.ts'

const caret = page.getByTestId('virtual-caret')

function setupMode(mode: MarkMode, text: string): Fixture {
  const fixture = setupFixture({ extensionOptions: { markMode: mode } })
  const { n } = fixture
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

  it('draws in every mark mode', async () => {
    for (const mode of ['hide', 'focus', 'show'] as const) {
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
    using fixture = setupFixture({ extensionOptions: { markMode: 'hide' } })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph()))
    fixture.view.focus()
    await expect.element(caret).toBeVisible()
  })
})

describe('virtual caret next to atom marks', () => {
  const wikilink = page.getByTestId('wikilink')

  function setupFilePill(text: string): Fixture {
    const fixture = setupFixture({
      extensionOptions: {
        resolveFileLink: ({ href }) => href.startsWith('assets/'),
        markMode: 'hide',
      },
    })
    const { editor, n } = fixture
    editor.use(defineFileView({}))
    fixture.set(n.doc(n.paragraph(text)))
    fixture.view.focus()
    return fixture
  }

  it('is visible at the end of a paragraph holding only a wikilink', async () => {
    using fixture = setupMode('hide', '[[note]]<a>')
    void fixture
    await expect.element(caret).toBeVisible()
  })

  it('is visible at the start of a paragraph holding only a wikilink', async () => {
    using fixture = setupMode('hide', '<a>[[note]]')
    void fixture
    await expect.element(caret).toBeVisible()
  })

  it('is visible at the end of a wikilink preceded by text', async () => {
    using fixture = setupMode('hide', 'head [[note]]<a>')
    void fixture
    await expect.element(caret).toBeVisible()
  })

  it('is visible at the start of a wikilink followed by text', async () => {
    using fixture = setupMode('hide', '<a>[[note]] tail')
    void fixture
    await expect.element(caret).toBeVisible()
  })

  it('is visible at the end of a wikilink followed by text', async () => {
    using fixture = setupMode('hide', '[[note]]<a> tail')
    void fixture
    await expect.element(caret).toBeVisible()
  })

  it('is visible between two adjacent wikilinks', async () => {
    using fixture = setupMode('hide', '[[a]]<a>[[b]]')
    void fixture
    await expect.element(caret).toBeVisible()
  })

  it('is visible at the end of a lone wikilink in show mode', async () => {
    using fixture = setupMode('show', '[[note]]<a>')
    void fixture
    await expect.element(caret).toBeVisible()
  })

  it('draws the caret flush against the wikilink label right edge', async () => {
    using fixture = setupMode('hide', 'head [[note]]<a>')
    void fixture
    await expect.element(caret).toBeVisible()
    const previewRight = () => wikilink.element().getBoundingClientRect().right
    const caretLeft = () => getCaretElement().getBoundingClientRect().left
    await expect.poll(() => Math.abs(caretLeft() - previewRight())).toBeLessThanOrEqual(2)
  })

  it('draws the caret flush against the wikilink label left edge', async () => {
    using fixture = setupMode('hide', '<a>[[note]] tail')
    void fixture
    await expect.element(caret).toBeVisible()
    const previewLeft = () => wikilink.element().getBoundingClientRect().left
    const caretLeft = () => getCaretElement().getBoundingClientRect().left
    await expect.poll(() => Math.abs(caretLeft() - previewLeft())).toBeLessThanOrEqual(2)
  })

  it('is visible at the end of a paragraph holding only a file pill', async () => {
    using fixture = setupFilePill('[report.pdf](assets/report.pdf)<a>')
    void fixture
    await expect.element(caret).toBeVisible()
  })
})

describe('virtual caret viewport reveal', () => {
  // Enough paragraphs to push the last one well past the viewport bottom.
  function fillLongDoc(fixture: Fixture, lastText: string): void {
    const { n } = fixture
    const fillers = Array.from({ length: 80 }, (_, index) => n.paragraph(`filler ${index}`))
    fixture.set(n.doc(n.paragraph('first'), ...fillers, n.paragraph(lastText)))
  }

  function setupLongDoc(lastText: string): Fixture {
    const fixture = setupFixture({ extensionOptions: { markMode: 'hide' } })
    fillLongDoc(fixture, lastText)
    return fixture
  }

  function caretWithinViewport(): boolean {
    const rect = getCaretElement().getBoundingClientRect()
    return rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight
  }

  it('scrolls an off-screen caret into view when the editor gains focus', async () => {
    using fixture = setupLongDoc('last<a>')
    window.scrollTo(0, 0)
    fixture.view.focus()
    await expect.element(caret).toBeVisible()
    await expect.poll(caretWithinViewport).toBe(true)
    expect(window.scrollY).toBeGreaterThan(0)
  })

  it('scrolls to the caret after a programmatic selection jump', async () => {
    using fixture = setupLongDoc('last')
    const { view } = fixture
    view.dispatch(view.state.tr.setSelection(Selection.atStart(view.state.doc)))
    view.focus()
    await expect.element(caret).toBeVisible()
    window.scrollTo(0, 0)
    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)))
    await expect.poll(caretWithinViewport).toBe(true)
    expect(window.scrollY).toBeGreaterThan(0)
  })

  it('leaves the scroll position alone while the editor is blurred', async () => {
    using fixture = setupLongDoc('last')
    const { view } = fixture
    window.scrollTo(0, 0)
    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(window.scrollY).toBe(0)
  })

  it('does not scroll when a doc change merely remaps the selection', async () => {
    using fixture = setupLongDoc('last<a>')
    const { view } = fixture
    view.focus()
    await expect.poll(caretWithinViewport).toBe(true)
    window.scrollTo(0, 0)
    // Insert above the caret without touching the selection: the caret's
    // position shifts by mapping, which must not count as a placement.
    view.dispatch(view.state.tr.insertText('x', 1))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(window.scrollY).toBe(0)
  })

  it('scrolls a nested scrollable container to reveal the caret', async () => {
    using fixture = setupFixture({ mount: false, extensionOptions: { markMode: 'hide' } })
    const { editor } = fixture
    const scroller = document.createElement('div')
    scroller.style.height = '300px'
    scroller.style.overflowY = 'auto'
    document.body.prepend(scroller)
    editor.mount(scroller.appendChild(document.createElement('div')))
    onTestFinished(() => {
      editor.unmount()
      scroller.remove()
    })
    fillLongDoc(fixture, 'last<a>')
    window.scrollTo(0, 0)
    scroller.scrollTop = 0
    fixture.view.focus()
    await expect.element(caret).toBeVisible()
    await expect.poll(() => scroller.scrollTop).toBeGreaterThan(0)
    // The caret element itself catches up once ProseMirror restores the DOM
    // selection, a beat after focus.
    await expect
      .poll(() => {
        const caretRect = getCaretElement().getBoundingClientRect()
        const scrollerRect = scroller.getBoundingClientRect()
        return caretRect.top >= scrollerRect.top && caretRect.bottom <= scrollerRect.bottom
      })
      .toBe(true)
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
