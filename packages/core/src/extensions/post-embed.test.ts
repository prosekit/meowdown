import { afterEach, describe, expect, it, vi } from 'vitest'

import { createTweet } from '../testing/tweet-fixture.ts'
import { createYouTubeVideo } from '../testing/youtube-fixture.ts'

import {
  defaultResolveXPost,
  defaultResolveYouTubeVideo,
  matchPostEmbed,
  parsePostEmbedSnapshot,
  parseXPostId,
} from './post-embed.ts'

describe('parseXPostId', () => {
  it('reads the id from twitter.com, x.com, and mobile URLs', () => {
    expect(parseXPostId('https://twitter.com/jack/status/20')).toBe('20')
    expect(parseXPostId('https://x.com/jack/status/20')).toBe('20')
    expect(parseXPostId('https://mobile.twitter.com/jack/status/20')).toBe('20')
    expect(parseXPostId('https://x.com/i/status/20?s=1')).toBe('20')
  })

  it('declines profile, foreign, and malformed URLs', () => {
    expect(parseXPostId('https://twitter.com/jack')).toBeUndefined()
    expect(parseXPostId('https://example.com/jack/status/20')).toBeUndefined()
    expect(parseXPostId('x.com/jack/status/20')).toBeUndefined()
  })
})

describe('matchPostEmbed', () => {
  it('recognizes X posts', () => {
    expect(matchPostEmbed('https://x.com/jack/status/20')).toBe('x-post')
  })

  it('recognizes YouTube watch, short, shorts, embed, and live URLs', () => {
    expect(matchPostEmbed('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).toBe('youtube-video')
    expect(matchPostEmbed('https://youtu.be/aqz-KE-bpKQ')).toBe('youtube-video')
    expect(matchPostEmbed('https://www.youtube.com/shorts/aqz-KE-bpKQ')).toBe('youtube-video')
    expect(matchPostEmbed('https://www.youtube.com/embed/aqz-KE-bpKQ')).toBe('youtube-video')
    expect(matchPostEmbed('https://www.youtube.com/live/aqz-KE-bpKQ')).toBe('youtube-video')
  })

  it('declines plain images and other pages', () => {
    expect(matchPostEmbed('https://example.com/cat.png')).toBeUndefined()
    expect(matchPostEmbed('https://www.youtube.com/@Blender')).toBeUndefined()
    expect(matchPostEmbed('https://www.youtube.com/watch?v=short')).toBeUndefined()
  })
})

describe('parsePostEmbedSnapshot', () => {
  it('validates the data against the schema the kind names', () => {
    const tweet = createTweet()
    expect(parsePostEmbedSnapshot({ kind: 'x-post', data: tweet })).toEqual({
      kind: 'x-post',
      data: tweet,
    })
    const video = createYouTubeVideo()
    expect(parsePostEmbedSnapshot({ kind: 'youtube-video', data: video })).toEqual({
      kind: 'youtube-video',
      data: video,
    })
  })

  it('drops unknown fields', () => {
    const parsed = parsePostEmbedSnapshot({ kind: 'x-post', data: { ...createTweet(), extra: 1 } })
    expect(parsed?.data).not.toHaveProperty('extra')
  })

  it('rejects data of another kind, an unknown kind, and a missing kind', () => {
    expect(parsePostEmbedSnapshot({ kind: 'x-post', data: createYouTubeVideo() })).toBeUndefined()
    expect(parsePostEmbedSnapshot({ kind: 'other', data: createTweet() })).toBeUndefined()
    expect(parsePostEmbedSnapshot({ data: createTweet() })).toBeUndefined()
    expect(parsePostEmbedSnapshot({})).toBeUndefined()
  })
})

describe('default resolvers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches an X post once through the proxy, then answers synchronously', async () => {
    const tweet = createTweet('cached')
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ data: tweet })))
    const first = defaultResolveXPost('https://x.com/jack/status/1001')
    expect(first).toBeInstanceOf(Promise)
    expect(await first).toEqual(tweet)
    expect(defaultResolveXPost('https://x.com/jack/status/1001')).toEqual(tweet)
    expect(fetchSpy).toHaveBeenCalledExactlyOnceWith(
      'https://react-tweet.vercel.app/api/tweet/1001',
    )
  })

  it('answers undefined for an X post the proxy does not know', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: null }), { status: 404 }),
    )
    expect(await defaultResolveXPost('https://x.com/jack/status/1002')).toBeUndefined()
  })

  it('reads a YouTube video from oEmbed and keeps the URL on the snapshot', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          title: 'Big Buck Bunny',
          author_name: 'Blender',
          author_url: 'https://www.youtube.com/@Blender',
          thumbnail_url: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
          thumbnail_width: 480,
          thumbnail_height: 360,
          width: 200,
          height: 113,
        }),
      ),
    )
    const url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
    const video = await defaultResolveYouTubeVideo(url)
    expect(video).toMatchObject({ url, title: 'Big Buck Bunny' })
    expect(fetchSpy).toHaveBeenCalledExactlyOnceWith(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    )
    expect(defaultResolveYouTubeVideo(url)).toEqual(video)
  })
})
