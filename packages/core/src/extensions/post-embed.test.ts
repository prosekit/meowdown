import { afterEach, describe, expect, it, vi } from 'vitest'

import { createTweet } from '../testing/tweet-fixture.ts'
import { createXPost } from '../testing/x-post-fixture.ts'
import { createYouTubeVideo } from '../testing/youtube-fixture.ts'

import {
  defaultResolveXPost,
  defaultResolveYouTubeVideo,
  parsePostEmbedSnapshot,
} from './post-embed.ts'

describe('parsePostEmbedSnapshot', () => {
  it('validates the data against the schema the kind names', () => {
    const post = createXPost()
    expect(parsePostEmbedSnapshot({ kind: 'x-post', data: post })).toEqual({
      kind: 'x-post',
      data: post,
    })
    const video = createYouTubeVideo()
    expect(parsePostEmbedSnapshot({ kind: 'youtube-video', data: video })).toEqual({
      kind: 'youtube-video',
      data: video,
    })
  })

  it('drops unknown fields', () => {
    const parsed = parsePostEmbedSnapshot({ kind: 'x-post', data: { ...createXPost(), extra: 1 } })
    expect(parsed?.data).not.toHaveProperty('extra')
  })

  it('rejects data of another kind, an unknown kind, and a missing kind', () => {
    expect(parsePostEmbedSnapshot({ kind: 'x-post', data: createYouTubeVideo() })).toBeUndefined()
    expect(parsePostEmbedSnapshot({ kind: 'other', data: createXPost() })).toBeUndefined()
    expect(parsePostEmbedSnapshot({ data: createXPost() })).toBeUndefined()
    expect(parsePostEmbedSnapshot({})).toBeUndefined()
  })
})

describe('default resolvers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches an X post once through the proxy, converts it, then answers synchronously', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { ...createTweet('cached'), id_str: '1001' } })),
      )
    const first = defaultResolveXPost('https://x.com/jack/status/1001')
    expect(first).toBeInstanceOf(Promise)
    expect(await first).toEqual({ ...createXPost('cached'), id: '1001' })
    expect(defaultResolveXPost('https://x.com/jack/status/1001')).toEqual({
      ...createXPost('cached'),
      id: '1001',
    })
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
