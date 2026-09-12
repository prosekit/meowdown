import type { Tweet } from '@post-embed/types'
import { pasteText } from '@prosekit/core/test'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'
import { createTweet } from '../testing/tweet-fixture.ts'
import { createYouTubeVideo } from '../testing/youtube-fixture.ts'

import { defineEmbedPaste } from './embed-paste.ts'
import { defineImage, type ImageOptions } from './image.ts'
import { formatMagicComment, parseMagicComment } from './magic-comment.ts'

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

// The first resolved snapshot is written into the image's magic comment as
// `{"snapshot":{"kind":...,"data":{...}}}`; a saved snapshot renders in the
// first frame and never calls the resolver.
describe('snapshot persistence', () => {
  const tweet = createTweet('a -- b')
  const saved = `${TWEET}${formatMagicComment({ snapshot: { kind: 'x-post', data: tweet } })}`

  // The comment written behind `prefix`, and the snapshot it carries. The
  // schema writes the fields in its own order, so tests compare the parsed
  // object, not the string.
  function written(fixture: Fixture, prefix: string) {
    const markdown = docToMarkdown(fixture.editor.state.doc).trim()
    const comment = markdown.startsWith(prefix) ? markdown.slice(prefix.length) : ''
    return { markdown, comment, snapshot: parseMagicComment(comment)?.snapshot }
  }

  it('writes the resolved snapshot back, escaped, outside history', async () => {
    using fixture = setup(TWEET, { resolveXPost: () => Promise.resolve(tweet) })
    const { editor } = fixture
    await expect.element(xPostCard.getByText('a -- b')).toBeInTheDocument()
    await expect
      .poll(() => written(fixture, TWEET).snapshot)
      .toEqual({ kind: 'x-post', data: tweet })
    const { markdown, comment } = written(fixture, TWEET)
    expect(comment.slice('<!--'.length, -'-->'.length)).not.toContain('--')

    editor.commands.undo()
    expect(docToMarkdown(editor.state.doc).trim()).toBe(markdown)
  })

  it('renders a saved snapshot without calling the resolver', async () => {
    const resolveXPost = vi.fn(() => createTweet())
    using fixture = setup(saved, { resolveXPost })
    void fixture
    await expect.element(xPostCard.getByText('a -- b')).toBeInTheDocument()
    expect(resolveXPost).not.toHaveBeenCalled()
    expect(xPostCard.locate('[data-fallback]').query()).toBeNull()
  })

  it('replaces a snapshot that does not validate', async () => {
    using fixture = setup(`${TWEET}<!-- {"snapshot":{"kind":"x-post","data":{"bogus":1}}} -->`, {
      resolveXPost: () => createTweet(),
    })
    await expect.element(xPostCard.getByText('just setting up my twttr')).toBeInTheDocument()
    await expect
      .poll(() => written(fixture, TWEET).snapshot)
      .toEqual({ kind: 'x-post', data: createTweet() })
  })

  it('replaces a snapshot whose kind does not match the URL', async () => {
    const resolveYouTubeVideo = vi.fn(() => createYouTubeVideo())
    using fixture = setup(
      `${VIDEO}${formatMagicComment({ snapshot: { kind: 'x-post', data: tweet } })}`,
      { resolveYouTubeVideo },
    )
    await expect.element(videoCard.getByText('Big Buck Bunny')).toBeInTheDocument()
    expect(resolveYouTubeVideo).toHaveBeenCalledOnce()
    await expect
      .poll(() => written(fixture, VIDEO).snapshot)
      .toEqual({ kind: 'youtube-video', data: createYouTubeVideo() })
  })

  it('writes nothing when the resolver has no snapshot', async () => {
    using fixture = setup(TWEET, { resolveXPost: () => undefined })
    const { editor } = fixture
    await expect.element(xPostCard.locate('[data-fallback]')).toBeInTheDocument()
    expect(docToMarkdown(editor.state.doc).trim()).toBe(TWEET)
  })

  // The write-back replaces the whole image range, so the undo of the paste
  // that inserted the image maps over it and removes the snapshot too. An
  // insertion at the range end would leave the comment behind as plain text.
  it('undoing the paste that inserted the image removes the snapshot with it', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    editor.use(defineImage({ resolveXPost: () => tweet }))
    editor.use(defineEmbedPaste())
    fixture.set(n.doc(n.paragraph('<a>')))
    const url = 'https://x.com/jack/status/20'
    pasteText(view, url)
    await expect.poll(() => docToMarkdown(editor.state.doc)).toContain('"snapshot"')

    editor.commands.undo()
    expect(editor.state.doc.textContent).toBe(url)
    editor.commands.undo()
    expect(editor.state.doc.textContent).toBe('')
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

  // No snapshot from the resolver, so the width is the only thing written.
  it('writes a width comment when resized', async () => {
    using fixture = setup(VIDEO, { resolveYouTubeVideo: () => undefined })
    const { editor } = fixture
    await expect.element(videoResizable).toBeInTheDocument()
    endResize(200)
    await expect.element(videoResizable).toHaveAttribute('data-width', '200')
    expect(docToMarkdown(editor.state.doc).trim()).toBe(`${VIDEO}<!-- {"width":200} -->`)
  })

  it('keeps the saved snapshot when resized', async () => {
    const snapshot = { kind: 'youtube-video', data: createYouTubeVideo() }
    using fixture = setup(`${VIDEO}${formatMagicComment({ snapshot })}`, { resolveYouTubeVideo })
    const { editor } = fixture
    await expect.element(videoResizable).toBeInTheDocument()
    endResize(200)
    await expect.element(videoResizable).toHaveAttribute('data-width', '200')
    expect(docToMarkdown(editor.state.doc).trim()).toBe(
      `${VIDEO}${formatMagicComment({ width: 200, snapshot })}`,
    )
  })

  it('drops a stale height when resized again', async () => {
    using fixture = setup(`${VIDEO}<!-- {"width":100,"height":75} -->`, {
      resolveYouTubeVideo: () => undefined,
    })
    const { editor } = fixture
    await expect.element(videoResizable).toHaveAttribute('data-width', '100')
    endResize(320)
    await expect.element(videoResizable).toHaveAttribute('data-width', '320')
    expect(docToMarkdown(editor.state.doc).trim()).toBe(`${VIDEO}<!-- {"width":320} -->`)
  })
})
