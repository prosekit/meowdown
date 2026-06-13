import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineImagePreview } from './image-preview.ts'
import { defaultResolveImageUrl, type ImageUrlResolver } from './images.ts'
import { defineMarkMode } from './mark-mode.ts'

const preview = page.getByTestId('md-image')

function setup(resolveUrl: ImageUrlResolver = defaultResolveImageUrl): Fixture {
  const fixture = setupFixture()
  fixture.editor.use(defineImagePreview(resolveUrl))
  return fixture
}

describe('image preview', () => {
  it('renders a preview widget for a block holding an image', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('![cat](https://example.com/cat.png)')))
    await expect.element(preview).toBeInTheDocument()
    await expect
      .element(preview.locate('img'))
      .toHaveAttribute('src', 'https://example.com/cat.png')
    await expect.element(preview.locate('img')).toHaveAttribute('alt', 'cat')
  })

  it('anchors the preview inline, so trailing text follows it', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('before ![](https://example.com/cat.png) after')))
    await expect.element(preview).toBeInTheDocument()
    // The widget sits at the image's position rather than after the whole
    // block, so the trailing text is its next sibling in the DOM.
    expect(preview.element().nextSibling?.textContent).toContain('after')
  })

  it('removes the widget once the text stops being an image', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('![cat](https://example.com/cat.png)')))
    await expect.element(preview).toBeInTheDocument()

    // Delete the leading `!` so it becomes a plain link, not an image.
    fixture.view.dispatch(fixture.state.tr.delete(1, 2))
    await expect.element(preview).not.toBeInTheDocument()
  })

  it('does not render a relative src with the default resolver', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('![cat](assets/cat.png)')))
    await expect.element(preview).not.toBeInTheDocument()
  })

  it('renders a relative src through a custom resolver', async () => {
    using fixture = setup((src) => (src.startsWith('assets/') ? `fake://${src}` : null))
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('![cat](assets/cat.png)')))
    await expect.element(preview).toBeInTheDocument()
    await expect.element(preview.locate('img')).toHaveAttribute('src', 'fake://assets/cat.png')
  })

  it('renders nothing when the custom resolver returns null', async () => {
    using fixture = setup(() => null)
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('![cat](https://example.com/cat.png)')))
    await expect.element(preview).not.toBeInTheDocument()
  })

  it('does not render an image inside inline code', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('`![cat](https://example.com/cat.png)`')))
    await expect.element(preview).not.toBeInTheDocument()
  })

  it('does not render an image inside a code block', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: '' }, '![cat](https://example.com/cat.png)')))
    await expect.element(preview).not.toBeInTheDocument()
  })

  it('renders two images in one paragraph in document order', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(
      n.doc(n.paragraph('![a](https://example.com/1.png) ![b](https://example.com/2.png)')),
    )
    await expect.element(preview).toHaveLength(2)
  })

  it('keeps getMarkdown byte-identical with a preview present', async () => {
    using fixture = setup()
    const { n } = fixture
    const markdown = '![cat](https://example.com/cat.png)'
    fixture.set(n.doc(n.paragraph(markdown)))
    await expect.element(preview).toBeInTheDocument()
    expect(docToMarkdown(fixture.doc)).toBe(`${markdown}\n`)
  })

  it('still renders the preview in hide mark mode', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.editor.use(defineMarkMode('hide'))
    fixture.set(n.doc(n.paragraph('![cat](https://example.com/cat.png)')))
    await expect.element(preview).toBeInTheDocument()
  })
})
