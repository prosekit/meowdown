import type { Tweet } from '@post-embed/types'
import { createLRU } from 'lru.min'

const X_POST_HOSTS = /^(?:www\.|mobile\.)?(?:twitter\.com|x\.com)$/i
const STATUS_ID = /\/status(?:es)?\/(\d+)/

/**
 * The post id of an X status URL, or `undefined` for any other `src`.
 */
export function parseXPostId(src: string): string | undefined {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return undefined
  }
  if (!X_POST_HOSTS.test(url.hostname)) return undefined
  return STATUS_ID.exec(url.pathname)?.[1]
}

/**
 * Resolve the data for an X post URL, directly or as a promise. A synchronous
 * answer renders in the same frame as the document; a promise reserves a
 * placeholder until it settles. Return `undefined` when the post is
 * unavailable. Called once per rendered embed, so cache in the host.
 */
export type XPostResolver = (url: string) => Tweet | undefined | Promise<Tweet | undefined>

// react-tweet's hosted proxy in front of X's syndication API, which refuses
// browser origins; it answers `{ data: Tweet }` for a post id.
const X_POST_API = 'https://react-tweet.vercel.app/api/tweet/'

const cache = createLRU<string, Tweet | undefined | Promise<Tweet | undefined>>({ max: 64 })

async function fetchXPost(id: string): Promise<Tweet | undefined> {
  const response = await fetch(X_POST_API + id)
  if (!response.ok) return undefined
  const json = (await response.json()) as { data?: Tweet | null }
  return json.data ?? undefined
}

/**
 * Fetch a post through react-tweet's proxy. A settled post answers
 * synchronously, so a revisited document renders its cards in the first
 * frame; the first visit returns the in-flight fetch.
 */
export const defaultResolveXPost: XPostResolver = (url) => {
  const id = parseXPostId(url)
  if (id === undefined) return
  if (cache.has(id)) return cache.get(id)
  const pending = fetchXPost(id).then(
    (tweet) => {
      cache.set(id, tweet)
      return tweet
    },
    (error: unknown) => {
      cache.delete(id)
      throw error
    },
  )
  cache.set(id, pending)
  return pending
}
