import type { Tweet } from '@post-embed/types'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'
import { createTweet } from '../testing/tweet-fixture.ts'

import { defineImage } from './image.ts'
import type { XPostResolver } from './x-post-resolver.ts'

const pmRoot = page.locate('.ProseMirror')
const postEmbed = pmRoot.getByTestId('x-post-embed')
const card = postEmbed.locate('[data-post-embed="x-post"]')
const tweetIframe = pmRoot.getByTestId('tweet-embed')

const TWEET = '![](https://x.com/jack/status/20)'

// An editor whose tweet embeds ask `resolveXPost` for a saved snapshot.
function setup(
  markdown: string,
  resolveXPost: XPostResolver | undefined,
  persistTweetHeight = false,
): Fixture {
  const fixture = setupFixture()
  const { editor, n } = fixture
  editor.use(defineImage({ resolveXPost, persistTweetHeight }))
  fixture.set(n.doc(n.paragraph(markdown)))
  return fixture
}

describe('X post embed', () => {
  it('renders a synchronous snapshot in the first frame', () => {
    using fixture = setup(TWEET, () => createTweet())
    void fixture
    // No await: the card must be in the DOM before any task or paint.
    expect(card.query()).not.toBeNull()
    expect(postEmbed.element().hasAttribute('data-pending')).toBe(false)
    expect(card.element().textContent).toContain('just setting up my twttr')
    expect(tweetIframe.query()).toBeNull()
  })

  it('keeps the X post text selectable', async () => {
    using fixture = setup(TWEET, () => createTweet())
    void fixture
    const text = card.getByText('just setting up my twttr')
    await expect.element(text).toBeInTheDocument()
    expect(getComputedStyle(text.element()).userSelect).not.toBe('none')
  })

  it('reserves the persisted height until a promise settles, then writes the card height back', async () => {
    let settle!: (tweet: Tweet) => void
    const pending = new Promise<Tweet>((resolve) => {
      settle = resolve
    })
    using fixture = setup(`${TWEET}<!-- {"height":300} -->`, () => pending, true)
    const { editor } = fixture
    expect(postEmbed.element().hasAttribute('data-pending')).toBe(true)
    expect(getComputedStyle(postEmbed.element()).minHeight).toBe('300px')
    expect(card.query()).toBeNull()

    settle(createTweet())
    await expect.element(card).toBeInTheDocument()
    expect(postEmbed.element().hasAttribute('data-pending')).toBe(false)
    await vi.waitFor(() => {
      const height = /<!-- \{"height":(\d+)\} -->/.exec(docToMarkdown(editor.state.doc))?.[1]
      expect(height).toBeDefined()
      expect(Number(height)).not.toBe(300)
    })
  })

  it('reserves the default height when no height is persisted', () => {
    using fixture = setup(TWEET, () => new Promise<Tweet>(() => {}))
    void fixture
    expect(postEmbed.element().hasAttribute('data-pending')).toBe(true)
    expect(getComputedStyle(postEmbed.element()).minHeight).toBe('250px')
  })

  it('falls back to the provider iframe without a snapshot', async () => {
    using fixture = setup(TWEET, () => undefined)
    void fixture
    await expect.element(tweetIframe).toBeInTheDocument()
    expect(card.query()).toBeNull()
  })

  it('falls back to the provider iframe when the resolver rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      using fixture = setup(TWEET, () => Promise.reject(new Error('boom')))
      void fixture
      await expect.element(tweetIframe).toBeInTheDocument()
      expect(consoleError).toHaveBeenCalledWith(
        '[meowdown] resolveXPost failed:',
        expect.any(Error),
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it('renders the provider iframe when no resolver is configured', async () => {
    using fixture = setup(TWEET, undefined)
    void fixture
    await expect.element(tweetIframe).toBeInTheDocument()
    expect(postEmbed.query()).toBeNull()
  })
})
