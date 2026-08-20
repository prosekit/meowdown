import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

import { findNativeCaretRect } from './caret-rect.ts'

const caret = page.getByTestId('virtual-caret')
const pmRoot = page.locate('.ProseMirror')
const codeBlock = pmRoot.locate('pre code')
const codeToken = codeBlock.locate('[class*="tok-"]').first()
const paragraph = pmRoot.locate('p').first()

const RUST = ['let y = {', '    let x = 3;', '    x + 1', '};'].join('\n')
// `let a = 1;` ends in a punctuation token and `let b = 2;` opens with a
// keyword token, so highlighting leaves the newline alone in its own DOM text
// node. Without a language the same text is a single text node.
const TWO_STATEMENTS = ['let a = 1;', 'let b = 2;'].join('\n')
const WRAPPING = 'wrapping '.repeat(30).trim()

// WebKit floors the native rect's `left` to an integer, so the drawn caret can
// sit up to a pixel left of the glyph edge it hugs.
const X_TOLERANCE = 2

function measureCaretPoint(): { x: number; centerY: number } {
  const box = caret.element().getBoundingClientRect()
  return { x: box.left + box.width / 2, centerY: box.top + box.height / 2 }
}

/**
 * The client box of the single character at `index`, read from a DOM range.
 * The reference is the rendered glyph itself, so it holds whatever the engine
 * does with fonts, line boxes, and highlight spans.
 */
function measureCharacter(root: Element, index: number): DOMRect {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let remaining = index
  for (let node = walker.nextNode(); node != null; node = walker.nextNode()) {
    const text = node as Text
    if (remaining < text.data.length) {
      const range = text.ownerDocument.createRange()
      range.setStart(text, remaining)
      range.setEnd(text, remaining + 1)
      return range.getBoundingClientRect()
    }
    remaining -= text.data.length
  }
  throw new Error(`character index ${index} is past the end of the text`)
}

/**
 * The caret hugs `edge` of the character at `index`, on that character's line.
 */
async function expectCaretAtCharacter(
  root: () => Element,
  index: number,
  edge: 'left' | 'right',
): Promise<void> {
  await expect.element(caret).toBeVisible()
  await vi.waitFor(() => {
    const glyph = measureCharacter(root(), index)
    const point = measureCaretPoint()
    expect(Math.abs(point.x - glyph[edge])).toBeLessThan(X_TOLERANCE)
    expect(point.centerY).toBeGreaterThan(glyph.top)
    expect(point.centerY).toBeLessThan(glyph.bottom)
  })
}

/**
 * The caret sits on an empty line: at the left edge of the block's text, and
 * vertically clear of the neighbouring lines. `above` and `below` are character
 * indices on the lines that bracket it, `undefined` when the empty line is
 * first or last.
 */
async function expectCaretOnEmptyLine(
  root: () => Element,
  { left, above, below }: { left: number; above?: number; below?: number },
): Promise<void> {
  await expect.element(caret).toBeVisible()
  await vi.waitFor(() => {
    const element = root()
    const point = measureCaretPoint()
    expect(Math.abs(point.x - measureCharacter(element, left).left)).toBeLessThan(X_TOLERANCE)
    if (above != null) {
      expect(point.centerY).toBeGreaterThan(measureCharacter(element, above).bottom)
    }
    if (below != null) {
      expect(point.centerY).toBeLessThan(measureCharacter(element, below).top)
    }
  })
}

function markCursor(text: string, offset: number): string {
  return `${text.slice(0, offset)}<a>${text.slice(offset)}`
}

describe('virtual caret at a code block line break', () => {
  function setupCode(language: string, text: string, offset: number): Fixture {
    const fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language }, markCursor(text, offset))))
    fixture.view.focus()
    return fixture
  }

  it('draws at the end of the line before the break', async () => {
    using fixture = setupCode('rust', RUST, 34)
    void fixture
    await expect.element(codeToken).toBeInTheDocument()
    await expectCaretAtCharacter(() => codeBlock.element(), 33, 'right')
  })

  it('draws at the start of the line after the break', async () => {
    using fixture = setupCode('rust', RUST, 35)
    void fixture
    await expect.element(codeToken).toBeInTheDocument()
    await expectCaretAtCharacter(() => codeBlock.element(), 35, 'left')
  })

  it('draws at the start of an indented line after the break', async () => {
    using fixture = setupCode('rust', RUST, 25)
    void fixture
    await expect.element(codeToken).toBeInTheDocument()
    await expectCaretAtCharacter(() => codeBlock.element(), 25, 'left')
  })

  it('draws at the start of a line whose first token opens a highlight span', async () => {
    using fixture = setupCode('rust', TWO_STATEMENTS, 11)
    void fixture
    await expect.element(codeToken).toBeInTheDocument()
    await expectCaretAtCharacter(() => codeBlock.element(), 11, 'left')
  })

  it('draws at the start of a line in an unhighlighted code block', async () => {
    using fixture = setupCode('', TWO_STATEMENTS, 11)
    void fixture
    await expectCaretAtCharacter(() => codeBlock.element(), 11, 'left')
  })

  it('draws the two sides of one break at two different points', async () => {
    using before = setupCode('rust', RUST, 34)
    await expect.element(codeToken).toBeInTheDocument()
    await expect.element(caret).toBeVisible()
    const endOfLine = measureCaretPoint()

    const { n } = before
    before.set(n.doc(n.codeBlock({ language: 'rust' }, markCursor(RUST, 35))))
    await expect.element(caret).toBeVisible()
    await vi.waitFor(() => {
      const startOfNextLine = measureCaretPoint()
      expect(startOfNextLine.centerY).toBeGreaterThan(endOfLine.centerY)
      expect(startOfNextLine.x).toBeLessThan(endOfLine.x)
    })
  })
})

describe('virtual caret on an empty line', () => {
  function setupCode(text: string, offset: number): Fixture {
    const fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock(markCursor(text, offset))))
    fixture.view.focus()
    return fixture
  }

  it('draws on an empty line between two code lines', async () => {
    using fixture = setupCode('aaa\n\nbbb', 4)
    void fixture
    await expectCaretOnEmptyLine(() => codeBlock.element(), { left: 0, above: 0, below: 5 })
  })

  it('draws at the start of the line after an empty line', async () => {
    using fixture = setupCode('aaa\n\nbbb', 5)
    void fixture
    await expectCaretAtCharacter(() => codeBlock.element(), 5, 'left')
  })

  it('draws on the empty last line of a code block', async () => {
    using fixture = setupCode('let x = 1;\n', 11)
    void fixture
    await expectCaretOnEmptyLine(() => codeBlock.element(), { left: 0, above: 0 })
  })

  it('draws on the empty first line of a code block', async () => {
    using fixture = setupCode('\nfoo', 0)
    void fixture
    await expectCaretOnEmptyLine(() => codeBlock.element(), { left: 1, below: 1 })
  })
})

describe('virtual caret at a paragraph soft line break', () => {
  function setupParagraph(text: string, offset: number): Fixture {
    const fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph(markCursor(text, offset))))
    fixture.view.focus()
    return fixture
  }

  it('draws at the end of the line before a soft break', async () => {
    using fixture = setupParagraph('first line\nsecond line', 10)
    void fixture
    await expectCaretAtCharacter(() => paragraph.element(), 9, 'right')
  })

  it('draws at the start of the line after a soft break', async () => {
    using fixture = setupParagraph('first line\nsecond line', 11)
    void fixture
    await expectCaretAtCharacter(() => paragraph.element(), 11, 'left')
  })

  it('draws on an empty soft line', async () => {
    using fixture = setupParagraph('aaa\n\nbbb', 4)
    void fixture
    await expectCaretOnEmptyLine(() => paragraph.element(), { left: 0, above: 0, below: 5 })
  })
})

describe('virtual caret at a soft wrap boundary', () => {
  /**
   * The first character index whose glyph box sits on the second visual line.
   */
  function findFirstWrapIndex(root: Element): number {
    const firstTop = measureCharacter(root, 0).top
    for (let index = 1; index < WRAPPING.length; index++) {
      if (measureCharacter(root, index).top > firstTop + 1) return index
    }
    throw new Error('the paragraph did not wrap')
  }

  function setupWrappingParagraph(): Fixture {
    const fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph(markCursor(WRAPPING, 0))))
    fixture.view.focus()
    return fixture
  }

  // A soft wrap carries no newline, so the line-break rule must not reach it.
  // The two visual points at a wrap are both defensible and the engines
  // disagree about which to use, so the contract is that the native
  // measurement still decides.
  it('keeps the native measurement where a soft wrap offers two points', async () => {
    using fixture = setupWrappingParagraph()
    const { n } = fixture
    const index = findFirstWrapIndex(paragraph.element())
    fixture.set(n.doc(n.paragraph(markCursor(WRAPPING, index))))
    await expect.element(caret).toBeVisible()
    await vi.waitFor(() => {
      const nativeRect = findNativeCaretRect(fixture.view)
      expect(nativeRect).toBeDefined()
      if (nativeRect == null) return
      const point = measureCaretPoint()
      expect(Math.abs(point.x - nativeRect.left)).toBeLessThan(X_TOLERANCE)
      expect(Math.abs(point.centerY - (nativeRect.top + nativeRect.height / 2))).toBeLessThan(1)
    })
  })
})
