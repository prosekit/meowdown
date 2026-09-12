import { afterEach, describe, expect, it, vi } from 'vitest'

import { createTweet } from '../testing/tweet-fixture.ts'

import { defaultResolveXPost, parseXPostId } from './x-post.ts'

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

describe('defaultResolveXPost', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches once through the proxy, then answers synchronously from the cache', async () => {
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

  it('answers undefined for a post the proxy does not know', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: null }), { status: 404 }),
    )
    expect(await defaultResolveXPost('https://x.com/jack/status/1002')).toBeUndefined()
  })

  it('answers undefined for a URL that is not a post', () => {
    expect(defaultResolveXPost('https://example.com')).toBeUndefined()
  })
})
