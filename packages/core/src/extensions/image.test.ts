import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

import { defineImage } from './image.ts'

const pmRoot = page.locate('.ProseMirror')

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
