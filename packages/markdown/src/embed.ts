import { parseXPostId } from '@post-embed/schema'

import { safeParseURL } from './safe-parse-url.ts'

export type EmbedKind = 'x-post' | 'youtube-video'

const YOUTUBE_HOSTS = /^(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com)$/i

const YOUTU_BE_HOST = /^(?:www\.)?youtu\.be$/i

// A YouTube video id is a 64-bit value encoded as base64url, so it is always
// 11 characters from the `[A-Za-z0-9_-]` alphabet.
// Source: https://wiki.archiveteam.org/index.php/YouTube/Technical_details
const VIDEO_ID = /^[\w-]{11}$/

/**
 * The post id of an X status URL, or `undefined` for any other `src`.
 */
export { parseXPostId }

function isYouTubeVideo(src: string): boolean {
  const url = safeParseURL(src)
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
 * The embed card an image `src` renders as, or `undefined` for a plain image.
 */
export function matchEmbed(src: string): EmbedKind | undefined {
  if (parseXPostId(src) !== undefined) return 'x-post'
  if (isYouTubeVideo(src)) return 'youtube-video'
  return undefined
}
