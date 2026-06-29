import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import {
  getSelectionSnapshot,
  setCaret,
  setupFixture,
  traceKeyAt,
  traceKeySelection,
  type Fixture,
} from '../testing/index.ts'

import { defineImageClickHandler, type ImageClickHandler } from './image-click.ts'
import { defineImage } from './image.ts'
import { defineMarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')
const preview = pmRoot.getByTestId('image-preview')

function getSVGImageURL(width: number, height: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="pink"/></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

// Text:     A   B   C   !   [   i   m   g   ]   (   u   r   l   )   D   E   F
// Offset: 0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17
//
// The hidden image source `![img](url)` occupies the characters between offsets
// 3 and 14.
const TEXT = 'ABC![img](url)DEF'

// A hide-mode editor showing the image, shared by the caret-navigation and
// selection-ring suites below.
function setupHidden(): Fixture {
  const fixture = setupFixture()
  const { editor, n } = fixture
  editor.use(defineImage({ resolveImageUrl: () => getSVGImageURL(10, 10) }))
  editor.use(defineMarkMode('hide'))
  fixture.set(n.doc(n.paragraph(TEXT)))
  return fixture
}

describe('image', () => {
  it('renders an image preview in place of its source', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineImage({ resolveImageUrl: (src) => src }))
    const doc = n.doc(n.paragraph('![cat](https://example.com/cat.png)'))
    fixture.set(doc)
    await expect
      .element(pmRoot.getByAltText('cat'))
      .toHaveAttribute('src', 'https://example.com/cat.png')
  })

  it('renders each image at its own position, in order', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineImage({ resolveImageUrl: (src) => src }))
    const doc = n.doc(
      n.paragraph('a ![one](https://example.com/1.png) b ![two](https://example.com/2.png) c'),
    )
    fixture.set(doc)
    await expect
      .element(pmRoot.getByAltText('one'))
      .toHaveAttribute('src', 'https://example.com/1.png')
    await expect
      .element(pmRoot.getByAltText('two'))
      .toHaveAttribute('src', 'https://example.com/2.png')
  })

  it('renders a YouTube embed for ![](watch url)', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineImage({ resolveImageUrl: (src) => src }))
    const doc = n.doc(n.paragraph('![](https://youtu.be/dQw4w9WgXcQ)'))
    fixture.set(doc)
    await expect
      .element(pmRoot.getByTestId('youtube-embed'))
      .toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('renders a tweet embed for ![](status url)', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineImage({ resolveImageUrl: (src) => src }))
    const doc = n.doc(n.paragraph('![](https://twitter.com/jack/status/20)'))
    fixture.set(doc)
    await expect.element(pmRoot.getByTestId('tweet-embed')).toBeInTheDocument()
  })

  it('shows http(s) images by default when no resolver is given', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineImage())
    const doc = n.doc(n.paragraph('![cat](https://example.com/cat.png)'))
    fixture.set(doc)
    await expect
      .element(pmRoot.getByAltText('cat'))
      .toHaveAttribute('src', 'https://example.com/cat.png')
  })

  it('skips non-http images by default when no resolver is given', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineImage())
    const doc = n.doc(n.paragraph('![cat](cat.png)'))
    fixture.set(doc)
    await expect.element(pmRoot.getByAltText('cat')).not.toBeInTheDocument()
  })
})

// A hidden image is one caret stop in hide mode: arrowing onto it selects the
// whole `![img](url)`, the next arrow steps past, and Backspace/Delete remove it
// as a unit.
describe('image caret navigation in hide mode', () => {
  // Reaches the left edge (offset 3), selects the image, collapses to the right
  // edge (offset 14), then steps on into DEF.
  it('ArrowRight selects the image, then steps past into DEF', async () => {
    using fixture = setupHidden()
    setCaret(fixture, 1)
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
    using fixture = setupHidden()
    setCaret(fixture, 15)
    expect(await traceKeySelection(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      [
        "ABC![img](url)D┃EF",
        "ABC![img](url)┃DEF",
        "ABC❰![img](url)❱DEF",
        "ABC┃![img](url)DEF",
      ]
    `)
  })

  it('Backspace deletes the image as a unit, plain text one char', async () => {
    const result = [
      await traceKeyAt(setupHidden, 2, 'Backspace'), // between B and C
      await traceKeyAt(setupHidden, 3, 'Backspace'), // just before the image
      await traceKeyAt(setupHidden, 14, 'Backspace'), // just after the image
      await traceKeyAt(setupHidden, 15, 'Backspace'), // between D and E
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

// A caret inside the image source, not at its edge, is not an atom boundary, so
// Backspace deletes a single character rather than the whole image (which holds
// in every mode).
describe('Backspace inside the image source deletes one character', () => {
  function setupShow(): Fixture {
    const fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineImage({ resolveImageUrl: () => getSVGImageURL(10, 10) }))
    editor.use(defineMarkMode('show'))
    fixture.set(n.doc(n.paragraph(TEXT)))
    return fixture
  }

  it('Backspace deletes one source character, not the whole image', async () => {
    expect(await traceKeyAt(setupShow, 7, 'Backspace')).toMatchInlineSnapshot(
      `"ABC![im┃g](url)DEF  ->  ABC![i┃g](url)DEF"`,
    )
  })
})

describe('image selection ring in hide mode', () => {
  // Selecting the whole `![img](url)` rings the preview; a collapsed caret next
  // to it does not. This is what the `md-atom-selected` decoration drives.
  it('rings the preview only while the image is selected', async () => {
    using fixture = setupHidden()

    // Put the caret just before the image
    setCaret(fixture, 3)
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"ABC┃![img](url)DEF"`)
    await expect.element(preview).toHaveStyle({ outlineStyle: 'none' })

    // Selects the whole image
    await userEvent.keyboard('{ArrowRight}')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"ABC❰![img](url)❱DEF"`)
    await expect.element(preview).toHaveStyle({ outlineStyle: 'solid' })

    // Steps past, collapses the caret
    await userEvent.keyboard('{ArrowRight}')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"ABC![img](url)┃DEF"`)
    await expect.element(preview).toHaveStyle({ outlineStyle: 'none' })
  })

  it('rings the preview when selected from its right edge', async () => {
    using fixture = setupHidden()

    // Put the caret just after the image
    setCaret(fixture, 14)
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"ABC![img](url)┃DEF"`)
    await expect.element(preview).toHaveStyle({ outlineStyle: 'none' })

    // Selects the whole image
    await userEvent.keyboard('{ArrowLeft}')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"ABC❰![img](url)❱DEF"`)
    await expect.element(preview).toHaveStyle({ outlineStyle: 'solid' })
  })
})

describe('image click callback', () => {
  // Render `markdown` with a click handler attached, showing http(s) images as-is.
  function applyClickable(
    fixture: Fixture,
    markdown: string,
    onImageClick: ImageClickHandler,
  ): void {
    const { editor, n } = fixture
    editor.use(defineImage({ resolveImageUrl: (src) => src }))
    editor.use(defineImageClickHandler(onImageClick))
    fixture.set(n.doc(n.paragraph(markdown)))
  }

  it('fires with the markdown src and alt when the preview is clicked', async () => {
    const onImageClick = vi.fn<ImageClickHandler>()
    using fixture = setupFixture()
    applyClickable(fixture, '![cat](https://example.com/cat.png)', onImageClick)
    await expect.element(preview).toBeInTheDocument()
    await userEvent.click(preview)
    await vi.waitFor(() => {
      expect(onImageClick).toHaveBeenCalledWith(
        expect.objectContaining({ src: 'https://example.com/cat.png', alt: 'cat' }),
      )
    })
  })

  it('passes the originating MouseEvent', async () => {
    const onImageClick = vi.fn<ImageClickHandler>()
    using fixture = setupFixture()
    applyClickable(fixture, '![cat](https://example.com/cat.png)', onImageClick)
    await expect.element(preview).toBeInTheDocument()
    await userEvent.click(preview)
    await vi.waitFor(() => expect(onImageClick).toHaveBeenCalled())
    expect(onImageClick.mock.calls[0][0].event).toBeInstanceOf(MouseEvent)
  })

  it('does not fire when plain text is clicked', async () => {
    const onImageClick = vi.fn<ImageClickHandler>()
    using fixture = setupFixture()
    applyClickable(fixture, 'hello ![cat](https://example.com/cat.png)', onImageClick)
    await expect.element(preview).toBeInTheDocument()
    await userEvent.click(pmRoot.getByText('hello', { exact: false }))
    expect(onImageClick).not.toHaveBeenCalled()
  })

  it('reports each adjacent image by its own src and alt', async () => {
    const onImageClick = vi.fn<ImageClickHandler>()
    using fixture = setupFixture()
    applyClickable(
      fixture,
      '![one](https://example.com/1.png)![two](https://example.com/2.png)',
      onImageClick,
    )
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

// Releasing a resize rewrites only the trailing `<!-- {"width":N} -->` comment;
// the inline-mark plugin re-derives the `width` attribute back onto the mark.
describe('image resize', () => {
  const resizable = pmRoot.getByTestId('image-resizable')

  function setupResize(markdown: string, url = getSVGImageURL(10, 10)): Fixture {
    const fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineImage({ resolveImageUrl: () => url }))
    editor.use(defineMarkMode('hide'))
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

  // Every orientation must pair the persisted width with a derived height. A
  // portrait image (aspect ratio < 1) is the regression: the component switches
  // to `width: min-content`, which without a real height collapses to the CSS
  // min-width floor instead of honoring the width.
  it.each([
    { orientation: 'portrait', imageWidth: 10, imageHeight: 20, dataHeight: '400' },
    { orientation: 'landscape', imageWidth: 20, imageHeight: 10, dataHeight: '100' },
    { orientation: 'square', imageWidth: 10, imageHeight: 10, dataHeight: '200' },
  ])(
    'pairs a persisted width with a height for a $orientation image',
    async ({ imageWidth, imageHeight, dataHeight }) => {
      using fixture = setupResize(
        '![cat](u)<!-- {"width":200} -->',
        getSVGImageURL(imageWidth, imageHeight),
      )
      void fixture
      await expect.element(resizable).toHaveAttribute('data-width', '200')
      await expect.element(resizable).toHaveAttribute('data-height', dataHeight)
    },
  )

  it('writes a width comment when resized', async () => {
    using fixture = setupResize('![cat](u)')
    await expect.element(resizable).toBeInTheDocument()
    endResize(320)
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe('![cat](u)<!-- {"width":320} -->')
    })
  })

  it('replaces an existing width comment when resized again', async () => {
    using fixture = setupResize('![cat](u)<!-- {"width":100} -->')
    await expect.element(resizable).toHaveAttribute('data-width', '100')
    endResize(320)
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe('![cat](u)<!-- {"width":320} -->')
    })
    await expect.element(resizable).toHaveAttribute('data-width', '320')
  })
})
