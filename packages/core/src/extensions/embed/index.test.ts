import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture } from '../../testing/index.ts'
import { defineImages } from '../images.ts'

const pmRoot = page.locate('.ProseMirror')

describe('embeds in the editor', () => {
  it('renders a YouTube embed for ![](watch url)', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineImages({ resolveImageUrl: (src) => src }))
    const doc = n.doc(n.paragraph('![](https://youtu.be/dQw4w9WgXcQ)'))
    fixture.set(doc)
    await expect
      .element(pmRoot.getByTestId('youtube-embed'))
      .toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('renders a tweet embed for ![](status url)', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineImages({ resolveImageUrl: (src) => src }))
    const doc = n.doc(n.paragraph('![](https://twitter.com/jack/status/20)'))
    fixture.set(doc)
    await expect.element(pmRoot.getByTestId('tweet-embed')).toBeInTheDocument()
  })

  it('falls back to <img> for a non-embeddable image', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineImages({ resolveImageUrl: (src) => src }))
    const doc = n.doc(n.paragraph('![cat](https://example.com/cat.png)'))
    fixture.set(doc)
    await expect
      .element(pmRoot.getByAltText('cat'))
      .toHaveAttribute('src', 'https://example.com/cat.png')
  })
})
