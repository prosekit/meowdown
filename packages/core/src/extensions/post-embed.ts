import type { Resolver } from '@meowdown/embed/x'
import { parseXPostId } from '@meowdown/markdown'
import { fromSyndication } from '@post-embed/exporter/x/syndication'
import { XPostSchema, YouTubeVideoSchema } from '@post-embed/schema'
import type { XPost, YouTubeVideo } from '@post-embed/types'
import { createLRU } from 'lru.min'
import * as v from 'valibot'

export type XPostResolver = Resolver<XPost>
export type YouTubeVideoResolver = Resolver<YouTubeVideo>

/**
 * Wrap a loader in a 64-entry LRU keyed by URL. A settled URL answers
 * synchronously after success; failed or empty loads can retry on the next call.
 * A revisited document renders successfully loaded cards in the first
 * frame; the first visit returns the in-flight load.
 */
function cached<T>(load: (url: string) => Promise<T | undefined>): Resolver<T> {
  const cache = createLRU<string, T | undefined | Promise<T | undefined>>({ max: 64 })
  return (url) => {
    if (cache.has(url)) return cache.get(url)
    const pending = load(url).then(
      (value) => {
        if (value == null) cache.delete(url)
        else cache.set(url, value)
        return value
      },
      (error: unknown) => {
        cache.delete(url)
        throw error
      },
    )
    cache.set(url, pending)
    return pending
  }
}

// react-tweet's hosted proxy in front of X's syndication API, which refuses
// browser origins; it answers `{ data }` with the syndication tweet for a post id.
const X_POST_API = 'https://react-tweet.vercel.app/api/tweet/'

export const defaultResolveXPost: XPostResolver = cached(async (url) => {
  const id = parseXPostId(url)
  if (id === undefined) return
  const response = await fetch(X_POST_API + id)
  if (response.status === 404 || response.status === 410) return
  if (!response.ok) throw new Error(`X post ${id}: HTTP ${response.status}`)
  const json = (await response.json().catch(() => {
    throw new Error(`X post ${id}: invalid JSON response`)
  })) as object
  if (json == null || typeof json !== 'object' || !('data' in json)) {
    throw new Error(`X post ${id}: response is missing data`)
  }
  if (json.data == null) return
  const result = fromSyndication(json.data)
  if (result.issues) {
    const paths = result.issues.map((issue) => {
      return (
        issue.path
          ?.map((segment) => String(typeof segment === 'object' ? segment.key : segment))
          .join('.') || '(root)'
      )
    })
    throw new Error(`X post ${id}: invalid data at ${paths.join(', ')}`)
  }
  return result.value
})

// YouTube's oEmbed endpoint allows cross-origin requests; the snapshot is its
// answer plus the video URL.
const YOUTUBE_OEMBED_API = 'https://www.youtube.com/oembed?format=json&url='

export const defaultResolveYouTubeVideo: YouTubeVideoResolver = cached(async (url) => {
  const response = await fetch(YOUTUBE_OEMBED_API + encodeURIComponent(url))
  if (!response.ok) return
  return { url, ...((await response.json()) as Omit<YouTubeVideo, 'url'>) }
})

/**
 * The `snapshot` field of an image's magic comment: the card kind and the
 * data post-embed renders. The kind is stored explicitly, so a saved snapshot
 * is validated once, against the schema it names.
 */
export type PostEmbedSnapshot =
  | { kind: 'x-post'; data: XPost }
  | { kind: 'youtube-video'; data: YouTubeVideo }

const PostEmbedSnapshotSchema: v.GenericSchema<unknown, PostEmbedSnapshot> = v.variant('kind', [
  v.object({ kind: v.literal('x-post'), data: XPostSchema }),
  v.object({ kind: v.literal('youtube-video'), data: YouTubeVideoSchema }),
])

/**
 * The snapshot a card renders from a saved JSON object, or `undefined` when
 * the object does not validate. Unknown fields are dropped, so a persisted
 * snapshot is exactly what the card needs.
 */
export function parsePostEmbedSnapshot(value: unknown): PostEmbedSnapshot | undefined {
  const result = v.safeParse(PostEmbedSnapshotSchema, value)
  return result.success ? result.output : undefined
}
