import type { XPost } from '@post-embed/types'

/**
 * A minimal saved X post: no avatar or media URL, so rendering it never
 * requests the network. Equals what `fromSyndication` makes of `createTweet`.
 */
export function createXPost(text = 'just setting up my twttr'): XPost {
  return {
    id: '20',
    createdAt: '2006-03-21T20:50:14.000Z',
    lang: 'en',
    author: { name: 'jack', handle: 'jack', verified: 'blue' },
    body: text ? [{ type: 'text', text }] : [],
  }
}
