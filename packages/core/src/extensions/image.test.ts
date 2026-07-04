import { NodeSelection } from '@prosekit/pm/state'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { findText } from '../testing/find-text.ts'
import {
  getSelectionSnapshot,
  setupFixture,
  traceKeyAt,
  traceKeySelection,
  type Fixture,
} from '../testing/index.ts'

import { defineImageClickHandler, type ImageClickHandler } from './image-click.ts'
import { defineImage } from './image.ts'
import type { MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')
const preview = pmRoot.getByTestId('image-preview')

function getSVGImageURL(width: number, height: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="pink"/>` +
    `</svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

// An editor showing the image in the given mark mode.
function setup(mode: MarkMode, text: string): Fixture {
  const fixture = setupFixture({ extensionOptions: { markMode: mode } })
  const { editor, n } = fixture
  editor.use(defineImage({ resolveImageUrl: () => getSVGImageURL(10, 10) }))
  fixture.set(n.doc(n.paragraph(text)))
  fixture.view.focus()
  return fixture
}

function setupHidden(text: string): Fixture {
  return setup('hide', text)
}

// A hidden image is one caret stop: arrowing onto it selects the whole
// `![img](url)`, and the next arrow steps past it.
describe('image caret navigation', () => {
  it('ArrowRight selects the image, then steps past into DEF', async () => {
    using fixture = setupHidden('A<a>BC![img](url)DEF')
    expect(await traceKeySelection(fixture, 'ArrowRight', 6)).toMatchInlineSnapshot(`
      [
        "A┃BC![img](url)DEF",
        "AB┃C![img](url)DEF",
        "ABC┃![img](url)DEF",
        "ABC❰![img](url)❱DEF",
        "ABC![img](url)┃DEF",
        "ABC![img](url)D┃EF",
        "ABC![img](url)DE┃F",
      ]
    `)
  })

  it('ArrowLeft selects the image, then collapses to its left edge', async () => {
    using fixture = setupHidden('ABC![img](url)D<a>EF')
    expect(await traceKeySelection(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      [
        "ABC![img](url)D┃EF",
        "ABC![img](url)┃DEF",
        "ABC❰![img](url)❱DEF",
        "ABC┃![img](url)DEF",
      ]
    `)
  })
})

// Backspace removes a hidden image as a unit, but a caret inside the source (not
// at its edge) is not an atom boundary, so Backspace there deletes one character.
describe('image deletion', () => {
  it('Backspace deletes the image as a unit, plain text one char', async () => {
    const result = [
      await traceKeyAt(setupHidden, 'AB<a>C![img](url)DEF', 'Backspace'),
      await traceKeyAt(setupHidden, 'ABC<a>![img](url)DEF', 'Backspace'),
      await traceKeyAt(setupHidden, 'ABC![img](url)<a>DEF', 'Backspace'),
      await traceKeyAt(setupHidden, 'ABC![img](url)D<a>EF', 'Backspace'),
    ]

    expect(result).toMatchInlineSnapshot(`
      [
        "AB┃C![img](url)DEF  ->  A┃C![img](url)DEF",
        "ABC┃![img](url)DEF  ->  AB┃![img](url)DEF",
        "ABC![img](url)┃DEF  ->  ABC┃DEF",
        "ABC![img](url)D┃EF  ->  ABC![img](url)┃EF",
      ]
    `)
  })
})

// Selecting the whole `![img](url)` rings the preview; a collapsed caret next to
// it does not. This is what the `md-atom-selected` decoration drives.
describe('image selection ring', () => {
  it('rings the preview only while the image is selected, from either edge', async () => {
    // A caret before the image does not ring it.
    using fixture = setupHidden('ABC<a>![img](url)DEF')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"ABC┃![img](url)DEF"`)
    await expect.element(preview).toHaveStyle({ outlineStyle: 'none' })

    // ArrowRight selects the whole image, ringing it.
    await userEvent.keyboard('{ArrowRight}')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"ABC❰![img](url)❱DEF"`)
    await expect.element(preview).toHaveStyle({ outlineStyle: 'solid' })

    // ArrowRight again steps past and collapses the caret, un-ringing it.
    await userEvent.keyboard('{ArrowRight}')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"ABC![img](url)┃DEF"`)
    await expect.element(preview).toHaveStyle({ outlineStyle: 'none' })

    // From the right edge, ArrowLeft selects the image again, ringing it.
    await userEvent.keyboard('{ArrowLeft}')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"ABC❰![img](url)❱DEF"`)
    await expect.element(preview).toHaveStyle({ outlineStyle: 'solid' })
  })

  it('does not ring the preview inside a node-selected block', async () => {
    using fixture = setupHidden('ABC![img](url)DEF')
    const { view } = fixture
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)))
    await expect.element(preview).toHaveStyle({ outlineStyle: 'none' })
  })
})

describe('image click callback', () => {
  // Render `markdown` with a click handler attached, showing http(s) images as-is.
  function setupClickable(markdown: string, onImageClick: ImageClickHandler): Fixture {
    const fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineImage({ resolveImageUrl: (src) => src }))
    editor.use(defineImageClickHandler(onImageClick))
    fixture.set(n.doc(n.paragraph(markdown)))
    return fixture
  }

  it('fires with the src, alt, and originating MouseEvent when clicked', async () => {
    const onImageClick = vi.fn<ImageClickHandler>()
    using fixture = setupClickable('![cat](https://example.com/cat.png)', onImageClick)
    void fixture
    await expect.element(preview).toBeInTheDocument()
    await userEvent.click(preview)
    await vi.waitFor(() => {
      expect(onImageClick).toHaveBeenCalledWith(
        expect.objectContaining({ src: 'https://example.com/cat.png', alt: 'cat' }),
      )
    })
    expect(onImageClick.mock.calls[0][0].event).toBeInstanceOf(MouseEvent)
  })

  it('does not fire when plain text is clicked', async () => {
    const onImageClick = vi.fn<ImageClickHandler>()
    using fixture = setupClickable('hello ![cat](https://example.com/cat.png)', onImageClick)
    void fixture
    await expect.element(preview).toBeInTheDocument()
    await userEvent.click(pmRoot.getByText('hello', { exact: false }))
    expect(onImageClick).not.toHaveBeenCalled()
  })

  it('reports each adjacent image by its own src and alt', async () => {
    const onImageClick = vi.fn<ImageClickHandler>()
    using fixture = setupClickable(
      '![one](https://example.com/1.png)![two](https://example.com/2.png)',
      onImageClick,
    )
    void fixture
    await expect.element(pmRoot.getByAltText('one')).toBeInTheDocument()
    await userEvent.click(pmRoot.getByAltText('one'))
    await userEvent.click(pmRoot.getByAltText('two'))
    await vi.waitFor(() => expect(onImageClick).toHaveBeenCalledTimes(2))
    expect(onImageClick.mock.calls.map((call) => call[0].src)).toEqual([
      'https://example.com/1.png',
      'https://example.com/2.png',
    ])
    expect(onImageClick.mock.calls.map((call) => call[0].alt)).toEqual(['one', 'two'])
  })
})

// Releasing a resize rewrites only the trailing `<!-- {"width":N,"height":M} -->`
// comment; the inline-mark plugin re-derives the `width`/`height` attributes back
// onto the mark.
describe('image resize', () => {
  const resizable = pmRoot.getByTestId('image-resizable')

  function setupResize(markdown: string, url = getSVGImageURL(10, 10)): Fixture {
    const fixture = setupFixture({ extensionOptions: { markMode: 'hide' } })
    const { editor, n } = fixture
    editor.use(defineImage({ resolveImageUrl: () => url }))
    fixture.set(n.doc(n.paragraph(markdown)))
    return fixture
  }

  function endResize(width: number): void {
    resizable
      .element()
      .dispatchEvent(new CustomEvent('resizeEnd', { detail: { width, height: 100 } }))
  }

  it('applies a persisted width to the resizable root', async () => {
    using fixture = setupResize('![cat](u)<!-- {"width":200} -->')
    void fixture
    await expect.element(resizable).toHaveAttribute('data-width', '200')
  })

  // A persisted height is applied directly, not recomputed from width: the
  // portrait image's derived height would be 200 / 0.5 = 400, but the comment's
  // 150 wins, so the box has its size before the load event.
  it('applies a persisted width and height to the resizable root', async () => {
    using fixture = setupResize(
      '![cat](u)<!-- {"width":200,"height":150} -->',
      getSVGImageURL(10, 20),
    )
    void fixture
    await expect.element(resizable).toHaveAttribute('data-width', '200')
    await expect.element(resizable).toHaveAttribute('data-height', '150')
  })

  it('pairs a persisted width with a derived height for a landscape image', async () => {
    using fixture = setupResize('![cat](u)<!-- {"width":200} -->', getSVGImageURL(20, 10))
    void fixture
    await expect.element(resizable).toHaveAttribute('data-width', '200')
    await expect.element(resizable).toHaveAttribute('data-height', '100')
  })

  // Portrait is the regression: the component switches to `width: min-content`,
  // which without a real height would collapse to the CSS min-width floor instead
  // of honoring the persisted width.
  it('pairs a persisted width with a derived height for a portrait image', async () => {
    using fixture = setupResize('![cat](u)<!-- {"width":200} -->', getSVGImageURL(10, 20))
    void fixture
    await expect.element(resizable).toHaveAttribute('data-width', '200')
    await expect.element(resizable).toHaveAttribute('data-height', '400')
  })

  it('writes a width and height comment when resized', async () => {
    using fixture = setupResize('![cat](u)')
    await expect.element(resizable).toBeInTheDocument()
    endResize(320)
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe('![cat](u)<!-- {"width":320,"height":100} -->')
    })
  })

  it('replaces an existing size comment when resized again', async () => {
    using fixture = setupResize('![cat](u)<!-- {"width":100} -->')
    await expect.element(resizable).toHaveAttribute('data-width', '100')
    endResize(320)
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe('![cat](u)<!-- {"width":320,"height":100} -->')
    })
    await expect.element(resizable).toHaveAttribute('data-width', '320')
  })

  it('keeps the same preview DOM when resized', async () => {
    using fixture = setupResize('![cat](u)<!-- {"width":100} -->')
    void fixture
    await expect.element(resizable).toHaveAttribute('data-width', '100')
    const rootBefore = resizable.element()
    const imageBefore = pmRoot.getByAltText('cat').element()
    endResize(320)
    await expect.element(resizable).toHaveAttribute('data-width', '320')
    await expect.element(resizable).toHaveAttribute('data-height', '100')
    expect(resizable.element()).toBe(rootBefore)
    expect(pmRoot.getByAltText('cat').element()).toBe(imageBefore)
  })

  it.each([
    { width: 150, height: 150 }, // square
    { width: 200, height: 100 }, // landscape
    { width: 100, height: 200 }, // portrait
  ])('sizes the preview from its aspect ratio $width / $height', async ({ width, height }) => {
    const expectedRatio = width / height

    using fixture = setupResize('![](url)', getSVGImageURL(width, height))
    void fixture

    await vi.waitFor(() => {
      const element = resizable.element()

      const dataRatio = Number.parseFloat(element.getAttribute('data-aspect-ratio') || '-1')

      const { width: displayWidth, height: displayHeight } = element
        .querySelector('img')!
        .getBoundingClientRect()
      const displayRatio = displayWidth / displayHeight

      expect(Math.abs(displayWidth - width)).toBeLessThan(20)
      expect(Math.abs(displayHeight - height)).toBeLessThan(20)
      expect(Math.abs(dataRatio - expectedRatio)).toBeLessThan(0.02)
      expect(Math.abs(displayRatio - expectedRatio)).toBeLessThan(0.02)
    })
  })

  it('shows a loading placeholder until the image loads', async () => {
    using fixture = setupResize('![cat](u)')
    void fixture
    // The placeholder is on as soon as the box renders, before the async load
    // fires; it is cleared once the image paints.
    expect(resizable.element()).toHaveAttribute('data-loading', '')
    await expect.element(resizable).not.toHaveAttribute('data-loading')
  })
})

describe('typing after an inline image', () => {
  it('types the next character after the image, not before it', async () => {
    using fixture = setup('hide', 'A![img](url)<a>')
    await expect.element(preview).toBeVisible()

    await userEvent.keyboard('B')
    expect(fixture.doc.textContent).toBe('A![img](url)B')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"A![img](url)B┃"`)
  })

  it('types after an image that sits between words', async () => {
    using fixture = setup('hide', 'see ![img](url)<a> here')
    await expect.element(preview).toBeVisible()

    await userEvent.keyboard('X')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"see ![img](url)X┃ here"`)
  })
})

// Typing inside the alt text changes the mark's attrs on every keystroke; the
// update method keeps the same <img> alive instead of rebuilding the preview.
describe('image mark view update', () => {
  it('keeps the same img element while the alt text is edited', async () => {
    using fixture = setup('show', 'ABC![alt1](url)DEF')

    const image1 = pmRoot.getByAltText('alt1')
    await expect.element(image1).toBeInTheDocument()
    const image1Element = image1.element()

    const { view } = fixture
    expect(fixture.doc.textContent).toMatchInlineSnapshot(`"ABC![alt1](url)DEF"`)
    const altStart = findText(fixture.doc, 'alt1')
    view.dispatch(
      view.state.tr.replaceWith(altStart, altStart + 'alt1'.length, view.state.schema.text('ALT2')),
    )
    expect(fixture.doc.textContent).toMatchInlineSnapshot(`"ABC![ALT2](url)DEF"`)

    const image2 = pmRoot.getByAltText('ALT2')
    await expect.element(image2).toBeInTheDocument()
    const image2Element = image2.element()
    expect(image2Element).toBe(image1Element)
  })
})
