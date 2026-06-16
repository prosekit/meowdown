import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture } from '../../testing/index.ts'
import { defineImages } from '../images.ts'

describe('embeds in the editor', () => {
  it('renders a YouTube embed for ![](watch url)', async () => {
    using fixture = setupFixture()
    fixture.editor.use(defineImages({ resolveImageUrl: (src) => src }))
    // REVIEW: update the brain/projects/meowdown/ to remembder a rule:
    // For better readability, do not write test like `fixture.n.doc(fixture.n.paragraph('xxx'))`
    // Always first extract the n to a variable, then write shorter code
    // The following is a good example
    // using fixture = setupFixture()
    // const { editor, n } = fixture
    // editor.use(defineImages({ resolveImageUrl: (src) => src }))
    // const doc = n.doc(n.paragraph('![](https://youtu.be/dQw4w9WgXcQ)'))
    // fixture.set(doc)
    fixture.set(fixture.n.doc(fixture.n.paragraph('![](https://youtu.be/dQw4w9WgXcQ)')))
    await expect
      .element(page.locate('.ProseMirror [data-testid="youtube-embed"]'))
      .toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    // REVIEW: do not write `[data-testid=` selector directly. Let's chain locators instead. The following is a good example.
    // Also remembder this in  brain/projects/meowdown/
    let pmRoot = page.locate('.ProseMirror')
    let embed = pmRoot.getByTestId('youtube-embed')
    await expect
      .element(embed)
      .toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('renders a tweet embed for ![](status url)', async () => {
    using fixture = setupFixture()
    fixture.editor.use(defineImages({ resolveImageUrl: (src) => src }))
    fixture.set(fixture.n.doc(fixture.n.paragraph('![](https://twitter.com/jack/status/20)')))
    await expect
      .element(page.locate('.ProseMirror [data-testid="tweet-embed"]'))
      .toBeInTheDocument()
  })

  it('falls back to <img> for a non-embeddable image', async () => {
    using fixture = setupFixture()
    fixture.editor.use(defineImages({ resolveImageUrl: (src) => src }))
    fixture.set(fixture.n.doc(fixture.n.paragraph('![cat](https://example.com/cat.png)')))
    await expect
      .element(page.locate('.ProseMirror img[alt="cat"]'))
      .toHaveAttribute('src', 'https://example.com/cat.png')
    // REVIEW: same as above
    const pmRoot = page.locate('.ProseMirror')
    const image = pmRoot.getByAltText('cat')
    await expect.element(image).toHaveAttribute('src', 'https://example.com/cat.png')

    // No embed iframe is rendered for a plain image.
    await expect.element(page.locate('.ProseMirror iframe')).not.toBeInTheDocument()
    // REVIEW: you write too many time `.ProseMirror`. Just set a global const pmRoot = page.locate('.ProseMirror')
  })
})
