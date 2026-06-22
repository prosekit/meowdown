import { describe, expect, it } from 'vitest'

import { matchTweet } from './tweet.ts'

describe('matchTweet', () => {
  it.each([
    'https://twitter.com/jack/status/20',
    'https://x.com/jack/status/20',
    'https://mobile.twitter.com/jack/status/20',
  ])('matches %s', (src) => {
    expect(matchTweet(src)?.key).toBe('tweet:20')
  })

  it('declines profile and non-tweet URLs', () => {
    expect(matchTweet('https://twitter.com/jack')).toBeUndefined()
    expect(matchTweet('https://example.com/jack/status/20')).toBeUndefined()
  })

  it('describes the first-party embed iframe with the tweet id', () => {
    const embed = matchTweet('https://x.com/jack/status/20')!
    expect(embed.kind).toBe('tweet')
    expect(embed.src).toContain('platform.twitter.com/embed/Tweet.html?id=20')
    expect(embed.className).toBe('md-embed md-embed-tweet')
    expect(embed.testid).toBe('tweet-embed')
  })
})
