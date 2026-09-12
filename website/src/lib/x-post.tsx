import type { XPostResolver } from '@meowdown/react'
import type { Tweet } from '@post-embed/types'
import { useEffect, useSyncExternalStore } from 'react'
import { useTweet } from 'react-tweet'

const CACHE_LIMIT = 32

interface Entry {
  tweet: Tweet | undefined
  settled: boolean
  settle: (tweet: Tweet | undefined) => void
  pending: Promise<Tweet | undefined>
}

// Insertion-ordered, so the first settled key is the least recently used.
const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()
let pendingIds: string[] = []

function notify(): void {
  pendingIds = [...entries].filter(([, entry]) => !entry.settled).map(([id]) => id)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getPendingIds(): string[] {
  return pendingIds
}

function parsePostId(url: string): string | undefined {
  try {
    return /\/status(?:es)?\/(\d+)/.exec(new URL(url).pathname)?.[1]
  } catch {
    return undefined
  }
}

function touch(id: string, entry: Entry): void {
  entries.delete(id)
  entries.set(id, entry)
  if (entries.size <= CACHE_LIMIT) return
  // Only a settled entry is safe to drop: an unsettled one still owes its promise.
  for (const [key, candidate] of entries) {
    if (candidate.settled) {
      entries.delete(key)
      return
    }
  }
}

/**
 * A settled post answers synchronously, so a revisited document renders its
 * cards in the first frame. The first visit returns a promise that
 * {@link XPostLoaders} settles through react-tweet's `useTweet`.
 */
export const resolveXPost: XPostResolver = (url) => {
  const id = parsePostId(url)
  if (id === undefined) return
  const cached = entries.get(id)
  if (cached) {
    touch(id, cached)
    return cached.settled ? cached.tweet : cached.pending
  }
  let settle!: (tweet: Tweet | undefined) => void
  const pending = new Promise<Tweet | undefined>((resolve) => {
    settle = resolve
  })
  touch(id, { tweet: undefined, settled: false, settle, pending })
  notify()
  return pending
}

function XPostLoader({ id }: { id: string }) {
  const { data, isLoading } = useTweet(id)
  useEffect(() => {
    if (isLoading) return
    const entry = entries.get(id)
    if (!entry || entry.settled) return
    entry.settled = true
    entry.tweet = data ?? undefined
    entry.settle(entry.tweet)
    notify()
  }, [id, data, isLoading])
  return null
}

/**
 * Mount once beside an editor: one `useTweet` per post the resolver is still
 * waiting on. react-tweet reads its own hosted `api/tweet/:id` endpoint,
 * since X's syndication API refuses browser origins.
 */
export function XPostLoaders() {
  const ids = useSyncExternalStore(subscribe, getPendingIds)
  return ids.map((id) => <XPostLoader key={id} id={id} />)
}
