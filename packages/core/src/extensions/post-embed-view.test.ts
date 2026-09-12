import type { Tweet } from '@post-embed/types'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'
import { createTweet } from '../testing/tweet-fixture.ts'
import { createYouTubeVideo } from '../testing/youtube-fixture.ts'

import { defineImage, type ImageOptions } from './image.ts'

const pmRoot = page.locate('.ProseMirror')
const xPostEmbed = pmRoot.getByTestId('x-post-embed')
const xPostCard = xPostEmbed.locate('[data-post-embed="x-post"]')
const videoEmbed = pmRoot.getByTestId('youtube-video-embed')
const videoCard = videoEmbed.locate('[data-post-embed="youtube-video"]')
const videoResizable = videoEmbed.getByTestId('embed-resizable')

const TWEET = '![](https://x.com/jack/status/20)'
const VIDEO = '![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)'

// An editor whose post embeds load through the given resolvers.
function setup(markdown: string, options: ImageOptions): Fixture {
  const fixture = setupFixture()
  const { editor, n } = fixture
  editor.use(defineImage(options))
  fixture.set(n.doc(n.paragraph(markdown)))
  return fixture
}

describe('X post embed', () => {
  it('renders the resolved post as a card with selectable text', async () => {
    using fixture = setup(TWEET, { resolveXPost: () => createTweet() })
    void fixture
    const text = xPostCard.getByText('just setting up my twttr')
    await expect.element(text).toBeInTheDocument()
    expect(getComputedStyle(text.element()).userSelect).not.toBe('none')
    expect(pmRoot.locate('iframe').query()).toBeNull()
  })

  it('shows the loading card until a promise settles', async () => {
    let settle!: (tweet: Tweet) => void
    const pending = new Promise<Tweet>((resolve) => {
      settle = resolve
    })
    using fixture = setup(TWEET, { resolveXPost: () => pending })
    void fixture
    await expect.element(xPostCard.locate('[data-fallback][data-pending]')).toBeInTheDocument()

    settle(createTweet())
    await expect.element(xPostCard.getByText('just setting up my twttr')).toBeInTheDocument()
  })

  it('shows the unavailable card without a snapshot', async () => {
    using fixture = setup(TWEET, { resolveXPost: () => undefined })
    void fixture
    await expect.element(xPostCard.locate('[data-fallback]')).toBeInTheDocument()
    expect(xPostCard.locate('[data-pending]').query()).toBeNull()
  })

  it('fetches through the default resolver when none is configured', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ data: createTweet('fetched by default') })))
    try {
      using fixture = setup('![](https://x.com/jack/status/2001)', {})
      void fixture
      await expect.element(xPostCard.getByText('fetched by default')).toBeInTheDocument()
      expect(fetchSpy).toHaveBeenCalledExactlyOnceWith(
        'https://react-tweet.vercel.app/api/tweet/2001',
      )
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

describe('YouTube video embed', () => {
  it('renders the resolved video as a card without an iframe', async () => {
    using fixture = setup(VIDEO, { resolveYouTubeVideo: () => createYouTubeVideo() })
    void fixture
    await expect.element(videoCard.getByText('Big Buck Bunny')).toBeInTheDocument()
    expect(pmRoot.locate('iframe').query()).toBeNull()
  })

  it('fetches through the default resolver when none is configured', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(createYouTubeVideo('fetched by default'))))
    try {
      using fixture = setup(VIDEO, {})
      void fixture
      await expect.element(videoCard.getByText('fetched by default')).toBeInTheDocument()
      expect(fetchSpy).toHaveBeenCalledOnce()
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

// Releasing a resize rewrites only the trailing `<!-- {"width":N} -->`; the
// card keeps its content height, so no height is persisted.
describe('YouTube video resize', () => {
  const resolveYouTubeVideo = () => createYouTubeVideo()

  function endResize(width: number): void {
    videoResizable
      .element()
      .dispatchEvent(new CustomEvent('resizeEnd', { detail: { width, height: 100 } }))
  }

  it('applies a persisted width to the card', async () => {
    using fixture = setup(`${VIDEO}<!-- {"width":320} -->`, { resolveYouTubeVideo })
    void fixture
    await expect.element(videoResizable).toHaveAttribute('data-width', '320')
    await expect.element(videoCard.getByText('Big Buck Bunny')).toBeInTheDocument()
    expect(getComputedStyle(videoCard.element()).width).toBe('320px')
  })

  it('writes a width comment when resized', async () => {
    using fixture = setup(VIDEO, { resolveYouTubeVideo })
    const { editor } = fixture
    await expect.element(videoResizable).toBeInTheDocument()
    endResize(200)
    await expect.element(videoResizable).toHaveAttribute('data-width', '200')
    expect(docToMarkdown(editor.state.doc).trim()).toBe(`${VIDEO}<!-- {"width":200} -->`)
  })

  it('drops a stale height when resized again', async () => {
    using fixture = setup(`${VIDEO}<!-- {"width":100,"height":75} -->`, { resolveYouTubeVideo })
    const { editor } = fixture
    await expect.element(videoResizable).toHaveAttribute('data-width', '100')
    endResize(320)
    await expect.element(videoResizable).toHaveAttribute('data-width', '320')
    expect(docToMarkdown(editor.state.doc).trim()).toBe(`${VIDEO}<!-- {"width":320} -->`)
  })
})
