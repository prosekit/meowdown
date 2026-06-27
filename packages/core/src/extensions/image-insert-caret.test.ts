import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { getSelectionSnapshot, setCaret, setupFixture, type Fixture } from '../testing/index.ts'

import { defineImage } from './image.ts'
import { defineMarkMode, type MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')
const preview = pmRoot.getByTestId('image-preview')

const IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="pink"/></svg>'
const IMAGE_URL = `data:image/svg+xml;base64,${btoa(IMAGE_SVG)}`

function setup(mode: MarkMode, text: string): Fixture {
  const fixture = setupFixture()
  const { editor, n } = fixture
  editor.use(defineImage({ resolveImageUrl: () => IMAGE_URL }))
  editor.use(defineMarkMode(mode))
  fixture.set(n.doc(n.paragraph(text)))
  return fixture
}

// The image mark view has the same hidden-source/non-editable-preview shape as
// the wikilink, so a caret just after an inline image must also be a real caret
// stop: typing continues after the image, never before it. (Block-inserted
// images masked this, but inline images hit it.)
describe.each(['hide', 'focus'] as MarkMode[])(
  'typing after an inline image in %s mode',
  (mode) => {
    it('types the next character after the image, not before it', async () => {
      using fixture = setup(mode, 'A![img](url)')
      await expect.element(preview).toBeVisible()
      // Offset 12 = right after the image's closing `)`.
      setCaret(fixture, 12)

      await userEvent.keyboard('B')
      expect(fixture.doc.textContent).toBe('A![img](url)B')
      expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(`"A![img](url)B┃"`)
    })

    it('types after an image that sits between words', async () => {
      using fixture = setup(mode, 'see ![img](url) here')
      await expect.element(preview).toBeVisible()
      // Offset 15 = right after the closing `)` of `see ![img](url)`.
      setCaret(fixture, 15)

      await userEvent.keyboard('X')
      expect(fixture.doc.textContent).toBe('see ![img](url)X here')
    })
  },
)

// The image mark view wraps the URL run, so its contentDOM (the URL) sits before
// the preview: in show mode the preview paints right after the URL, with the raw
// `![img](url)` still fully visible around it. Confirm show mode keeps both the
// raw source and the preview.
describe('image show mode paints the preview after the URL', () => {
  it('shows the raw source and the preview together', async () => {
    using fixture = setup('show', 'A![img](url)B')
    await expect.element(preview).toBeVisible()

    // The raw markdown stays visible (not collapsed) in show mode.
    expect(fixture.dom.querySelector('p')?.innerText).toContain('![img](url)')

    // The preview is painted next to the URL inside the still-visible source.
    const previewRect = (preview.element() as HTMLElement).getBoundingClientRect()
    const range = document.createRange()
    const paragraph = fixture.dom.querySelector('p')!
    range.selectNodeContents(paragraph)
    // A coarse check: the preview has real width and is within the paragraph's
    // horizontal box.
    const paragraphRect = paragraph.getBoundingClientRect()
    expect(previewRect.width).toBeGreaterThan(0)
    expect(previewRect.left).toBeGreaterThanOrEqual(paragraphRect.left - 1)
  })
})
