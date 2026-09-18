import type { XPost } from '@post-embed/types'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'
import { createTweet } from '../testing/tweet-fixture.ts'
import { createXPost } from '../testing/x-post-fixture.ts'
import { createYouTubeVideo } from '../testing/youtube-fixture.ts'

import type { EditorExtensionOptions } from './extension.ts'
import type { ImageOptions } from './image.ts'
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
  const fixture = setupFixture({ extensionOptions: options })
  const { n } = fixture
  fixture.set(n.doc(n.paragraph(markdown)))
  return fixture
}

describe('post embed clicks', () => {
  // An editor whose post embeds render from the given resolvers and report
  // image clicks to `onImageClick`.
  function setupClickable(markdown: string, options: EditorExtensionOptions): Fixture {
    const fixture = setupFixture({ extensionOptions: options })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph(markdown)))
    return fixture
  }

  it('does not fire the image click handler from an X card', async () => {
    const onImageClick = vi.fn()
    using fixture = setupClickable(TWEET, { resolveXPost: () => createXPost(), onImageClick })
    void fixture
    const text = xPostCard.getByText('just setting up my twttr')
    await expect.element(text).toBeInTheDocument()
    await userEvent.click(text)
    expect(onImageClick).not.toHaveBeenCalled()
  })

  it('does not fire the image click handler from a YouTube card', async () => {
    const onImageClick = vi.fn()
    using fixture = setupClickable(VIDEO, {
      resolveYouTubeVideo: () => createYouTubeVideo(),
      onImageClick,
    })
    void fixture
    const play = videoCard.getByRole('button', { name: /^Play:/ })
    await expect.element(play).toBeInTheDocument()
    await userEvent.click(play)
    expect(onImageClick).not.toHaveBeenCalled()
  })
})

describe('X post embed', () => {
  it('passes separate resolver and media protocol options to X cards', async () => {
    const post = createXPost()
    post.media = [
      { type: 'photo', url: 'reflect-asset://saved/photo.png', width: 100, height: 100 },
    ]
    using fixture = setup(TWEET, {
      resolveXPost: () => post,
      mediaUrlProtocols: ['reflect-asset:'],
    })
    void fixture
    await expect
      .element(xPostCard.locate('[data-media] img'))
      .toHaveAttribute('src', 'reflect-asset://saved/photo.png')
  })

  it('renders the resolved post as a card with selectable text', async () => {
    using fixture = setup(TWEET, { resolveXPost: () => createXPost() })
    void fixture
    const text = xPostCard.getByText('just setting up my twttr')
    await expect.element(text).toBeInTheDocument()
    expect(getComputedStyle(text.element()).userSelect).not.toBe('none')
    expect(pmRoot.locate('iframe').query()).toBeNull()
  })

  it('shows the loading card until a promise settles', async () => {
    let settle!: (post: XPost) => void
    const pending = new Promise<XPost>((resolve) => {
      settle = resolve
    })
    using fixture = setup(TWEET, { resolveXPost: () => pending })
    void fixture
    await expect.element(xPostCard.locate('[data-fallback][data-pending]')).toBeInTheDocument()

    settle(createXPost())
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
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { ...createTweet('fetched by default'), id_str: '2001' } }),
        ),
      )
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

describe('host data and snapshot persistence', () => {
  const post = createXPost('a -- b')
  const saved = `${TWEET}${formatMagicComment({ snapshot: { kind: 'x-post', data: post } })}`

  // The comment written behind `prefix`, and the snapshot it carries. The
  // schema writes the fields in its own order, so tests compare the parsed
  // object, not the string.
  function written(fixture: Fixture, prefix: string) {
    const markdown = docToMarkdown(fixture.editor.state.doc).trim()
    const comment = markdown.startsWith(prefix) ? markdown.slice(prefix.length) : ''
    return { markdown, comment, snapshot: parseMagicComment(comment)?.snapshot }
  }

  it.each([TWEET, saved, `${TWEET}<!-- {"snapshot":{"kind":"x-post","data":{"bogus":1}}} -->`])(
    'renders host data without rewriting source Markdown: %s',
    async (source) => {
      const resolve = vi.fn(() => createXPost('Current host data'))
      using fixture = setup(source, { resolveXPost: resolve })
      const before = docToMarkdown(fixture.editor.state.doc).trim()
      await expect.element(xPostCard.getByText('Current host data')).toBeInTheDocument()
      expect(resolve).toHaveBeenCalledOnce()
      expect(docToMarkdown(fixture.editor.state.doc).trim()).toBe(before)
    },
  )

  it('replaces a snapshot whose kind does not match the URL', async () => {
    const resolveYouTubeVideo = vi.fn(() => createYouTubeVideo())
    using fixture = setup(
      `${VIDEO}${formatMagicComment({ snapshot: { kind: 'x-post', data: post } })}`,
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
