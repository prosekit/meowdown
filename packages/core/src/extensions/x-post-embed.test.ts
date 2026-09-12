import type { Tweet } from '@post-embed/types'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'
import { createTweet } from '../testing/tweet-fixture.ts'

import { defineImage } from './image.ts'
import type { XPostResolver } from './x-post.ts'

const pmRoot = page.locate('.ProseMirror')
const postEmbed = pmRoot.getByTestId('x-post-embed')
const card = postEmbed.locate('[data-post-embed="x-post"]')
const unavailable = postEmbed.locate('[data-fallback]')

const TWEET = '![](https://x.com/jack/status/20)'

// An editor whose tweet embeds ask `resolveXPost` for a saved snapshot.
function setup(markdown: string, resolveXPost: XPostResolver | undefined): Fixture {
  const fixture = setupFixture()
  const { editor, n } = fixture
  editor.use(defineImage({ resolveXPost }))
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
  })

  it('keeps the X post text selectable', async () => {
    using fixture = setup(TWEET, () => createTweet())
    void fixture
    const text = card.getByText('just setting up my twttr')
    await expect.element(text).toBeInTheDocument()
    expect(getComputedStyle(text.element()).userSelect).not.toBe('none')
  })

  it('reserves space until a promise settles', async () => {
    let settle!: (tweet: Tweet) => void
    const pending = new Promise<Tweet>((resolve) => {
      settle = resolve
    })
    using fixture = setup(TWEET, () => pending)
    void fixture
    expect(postEmbed.element().hasAttribute('data-pending')).toBe(true)
    expect(getComputedStyle(postEmbed.element()).minHeight).toBe('250px')
    expect(card.query()).toBeNull()

    settle(createTweet())
    await expect.element(card).toBeInTheDocument()
    expect(postEmbed.element().hasAttribute('data-pending')).toBe(false)
  })

  it('renders the unavailable card without a snapshot', async () => {
    using fixture = setup(TWEET, () => undefined)
    void fixture
    await expect.element(unavailable).toBeInTheDocument()
  })

  it('renders the unavailable card when the resolver rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      using fixture = setup(TWEET, () => Promise.reject(new Error('boom')))
      void fixture
      await expect.element(unavailable).toBeInTheDocument()
      expect(consoleError).toHaveBeenCalledWith(
        '[meowdown] resolveXPost failed:',
        expect.any(Error),
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it('fetches through the default resolver when none is configured', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ data: createTweet('fetched by default') })))
    try {
      using fixture = setup('![](https://x.com/jack/status/2001)', undefined)
      void fixture
      await expect.element(card).toBeInTheDocument()
      expect(card.element().textContent).toContain('fetched by default')
      expect(fetchSpy).toHaveBeenCalledExactlyOnceWith(
        'https://react-tweet.vercel.app/api/tweet/2001',
      )
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
