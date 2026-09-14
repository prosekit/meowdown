import type { Resolver } from '@post-embed/elements/x'
import { fromSyndication } from '@post-embed/exporter/x/syndication'
import { XPostSchema, YouTubeVideoSchema } from '@post-embed/schema'
import type { XPost, YouTubeVideo } from '@post-embed/types'
import { createLRU } from 'lru.min'
import * as v from 'valibot'

export type XPostResolver = Resolver<XPost>
export type YouTubeVideoResolver = Resolver<YouTubeVideo>

export type PostEmbedKind = 'x-post' | 'youtube-video'

const X_POST_HOSTS = /^(?:www\.|mobile\.)?(?:twitter\.com|x\.com)$/i
const STATUS_ID = /\/status(?:es)?\/(\d+)/

const YOUTUBE_HOSTS = /^(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com)$/i
const YOUTU_BE_HOST = /^(?:www\.)?youtu\.be$/i
// A YouTube video id is a 64-bit value encoded as base64url, so it is always
// 11 characters from the `[A-Za-z0-9_-]` alphabet.
// Source: https://wiki.archiveteam.org/index.php/YouTube/Technical_details
const VIDEO_ID = /^[\w-]{11}$/

function parseURL(src: string): URL | undefined {
  try {
    return new URL(src)
  } catch {
    return undefined
  }
}

/**
 * The post id of an X status URL, or `undefined` for any other `src`.
 */
export function parseXPostId(src: string): string | undefined {
  const url = parseURL(src)
  if (!url || !X_POST_HOSTS.test(url.hostname)) return undefined
  return STATUS_ID.exec(url.pathname)?.[1]
}

function isYouTubeVideo(src: string): boolean {
  const url = parseURL(src)
  if (!url) return false
  let videoId: string | null = null
  if (YOUTU_BE_HOST.test(url.hostname)) {
    videoId = url.pathname.slice(1)
  } else if (YOUTUBE_HOSTS.test(url.hostname)) {
    const [, firstSegment, secondSegment] = url.pathname.split('/')
    if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v')
    } else if (firstSegment === 'shorts' || firstSegment === 'embed' || firstSegment === 'live') {
      videoId = secondSegment ?? null
    }
  }
  return videoId !== null && VIDEO_ID.test(videoId)
}

/**
 * The post-embed card an image `src` renders as, or `undefined` for a plain image.
 */
export function matchPostEmbed(src: string): PostEmbedKind | undefined {
  if (parseXPostId(src) !== undefined) return 'x-post'
  if (isYouTubeVideo(src)) return 'youtube-video'
  return undefined
}

/**
 * Wrap a loader in a 64-entry LRU keyed by URL. A settled URL answers
 * synchronously, so a revisited document renders its cards in the first
 * frame; the first visit returns the in-flight load.
 */
function cached<T>(load: (url: string) => Promise<T | undefined>): Resolver<T> {
  const cache = createLRU<string, T | undefined | Promise<T | undefined>>({ max: 64 })
  return (url) => {
    if (cache.has(url)) return cache.get(url)
    const pending = load(url).then(
      (value) => {
        cache.set(url, value)
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
  if (!response.ok) return
  const json = (await response.json()) as { data?: unknown }
  return fromSyndication(json.data)
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
