import type { XPostResolver } from '@meowdown/react'
import type { Tweet } from '@post-embed/types'

// react-tweet's hosted proxy in front of X's syndication API, which refuses
// browser origins; it answers `{ data: Tweet }` for a post id.
const API_URL = 'https://react-tweet.vercel.app/api/tweet/'

const CACHE_LIMIT = 32

// REVIEW: 1 install https://npmx.dev/package/lru.min; 2. use its LRU cache instead of Map; 3. set the CACHE_LIMIT to 64

type Entry = Tweet | undefined | Promise<Tweet | undefined>

// Insertion-ordered, so the first key is the least recently used.
const cache = new Map<string, Entry>()

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

function remember(id: string, entry: Entry): void {
  cache.delete(id)
  cache.set(id, entry)
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

/**
 * A settled X post answers synchronously, so a revisited document renders its
 * cards in the first frame; the first visit returns the in-flight fetch.
 */
export const resolveXPost: XPostResolver = (url) => {
  const id = parsePostId(url)
  if (id === undefined) return
  if (cache.has(id)) {
    const entry = cache.get(id)
    remember(id, entry)
    return entry
  }
  const pending = fetchPost(id).then(
    (tweet) => {
      remember(id, tweet)
      return tweet
    },
    (error: unknown) => {
      cache.delete(id)
      throw error
    },
  )
  remember(id, pending)
  return pending
}
