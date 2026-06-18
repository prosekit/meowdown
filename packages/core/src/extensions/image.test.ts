import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { getSelectionSnapshot, setupFixture, type Fixture } from '../testing/index.ts'

import { defineImageClickHandler, type ImageClickHandler } from './image-click.ts'
import { defineImage } from './image.ts'
import { defineMarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')
const preview = pmRoot.getByTestId('image-preview')

const IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="pink"/></svg>'
const IMAGE_URL = `data:image/svg+xml;base64,${btoa(IMAGE_SVG)}`

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
  editor.use(defineImage({ resolveImageUrl: () => IMAGE_URL }))
  editor.use(defineMarkMode('hide'))
  fixture.set(n.doc(n.paragraph(TEXT)))
  return fixture
}

// Place a collapsed caret at text offset `offset`.
function setCaret(fixture: Fixture, offset: number): void {
  const { view } = fixture
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, offset + 1)))
  view.focus()
}

// Press `key` `times` times, capturing the selection snapshot before and after
// each press.
async function trace(fixture: Fixture, key: string, times: number): Promise<string[]> {
  const steps = [getSelectionSnapshot(fixture.state)]
  for (let index = 0; index < times; index++) {
    await userEvent.keyboard(`{${key}}`)
    steps.push(getSelectionSnapshot(fixture.state))
  }
  return steps
}

async function backspaceAt(offset: number): Promise<string> {
  using fixture = setupHidden()
  setCaret(fixture, offset)
  const before = getSelectionSnapshot(fixture.state)
  await userEvent.keyboard('{Backspace}')
  return `${before}  ->  ${getSelectionSnapshot(fixture.state)}`
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
    expect(await trace(fixture, 'ArrowRight', 6)).toMatchInlineSnapshot(`
      [
        "A▌BC![img](url)DEF",
        "AB▌C![img](url)DEF",
        "ABC▌![img](url)DEF",
        "ABC▛![img](url)▟DEF",
        "ABC![img](url)▌DEF",
        "ABC![img](url)D▌EF",
        "ABC![img](url)DE▌F",
      ]
    `)
  })

  it('ArrowLeft selects the image, then collapses to its left edge', async () => {
    using fixture = setupHidden()
    setCaret(fixture, 15)
    expect(await trace(fixture, 'ArrowLeft', 3)).toMatchInlineSnapshot(`
      [
        "ABC![img](url)D▌EF",
        "ABC![img](url)▌DEF",
        "ABC▛![img](url)▟DEF",
        "ABC▌![img](url)DEF",
      ]
    `)
  })

  it('Backspace deletes the image as a unit, plain text one char', async () => {
    const result = [
      await backspaceAt(2), // between B and C
      await backspaceAt(3), // just before the image
      await backspaceAt(14), // just after the image
      await backspaceAt(15), // between D and E
    ]

    expect(result).toMatchInlineSnapshot(`
      [
        "AB▌C![img](url)DEF  ->  A▌C![img](url)DEF",
        "ABC▌![img](url)DEF  ->  AB▌![img](url)DEF",
        "ABC![img](url)▌DEF  ->  ABC▌DEF",
        "ABC![img](url)D▌EF  ->  ABC![img](url)▌EF",
      ]
    `)
  })
})

describe('image selection ring in hide mode', () => {
  // Selecting the whole `![img](url)` rings the preview; a collapsed caret next
  // to it does not. This is what the `md-image-selected` decoration drives.
  it('rings the preview only while the image is selected', async () => {
    using fixture = setupHidden()

    // Put the caret just before the image
    setCaret(fixture, 3)
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"ABC▌![img](url)DEF"`)
    await expect.element(preview).toHaveStyle({ outlineStyle: 'none' })

    // Selects the whole image
    await userEvent.keyboard('{ArrowRight}')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot( `"ABC▛![img](url)▟DEF"`)
    await expect.element(preview).toHaveStyle({ outlineStyle: 'solid' })

    // Steps past, collapses the caret
    await userEvent.keyboard('{ArrowRight}')
    expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot( `"ABC![img](url)▌DEF"`)
    await expect.element(preview).toHaveStyle({ outlineStyle: 'none' })
  })

  it('rings the preview when selected from its right edge', async () => {
    using fixture = setupHidden()
    setCaret(fixture, 14) // image|DEF just after the image

    await expect.element(preview).toHaveStyle({ outlineStyle: 'none' })

    await userEvent.keyboard('{ArrowLeft}') // selects the whole image
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
