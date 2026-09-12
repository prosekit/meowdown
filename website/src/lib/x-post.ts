import type { XPostResolver } from '@meowdown/react'
import type { Tweet } from '@post-embed/types'
import { createLRU } from 'lru.min'

// react-tweet's hosted proxy in front of X's syndication API, which refuses
// browser origins; it answers `{ data: Tweet }` for a post id.
const API_URL = 'https://react-tweet.vercel.app/api/tweet/'

const CACHE_LIMIT = 64

const cache = createLRU<string, Tweet | undefined | Promise<Tweet | undefined>>({
  max: CACHE_LIMIT,
})

function parsePostId(url: string): string | undefined {
  try {
    return /\/status(?:es)?\/(\d+)/.exec(new URL(url).pathname)?.[1]
  } catch {
    return undefined
  }
}

async function fetchPost(id: string): Promise<Tweet | undefined> {
  const response = await fetch(API_URL + id)
  if (!response.ok) return undefined
  const json = (await response.json()) as { data?: Tweet | null }
  return json.data ?? undefined
}

/**
 * A settled X post answers synchronously, so a revisited document renders its
 * cards in the first frame; the first visit returns the in-flight fetch.
 */
export const resolveXPost: XPostResolver = (url) => {
  const id = parsePostId(url)
  if (id === undefined) return
  if (cache.has(id)) return cache.get(id)
  const pending = fetchPost(id).then(
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
