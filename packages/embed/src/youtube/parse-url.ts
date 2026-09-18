const YOUTUBE_HOSTS = /^(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com)$/i
const YOUTU_BE_HOST = /^(?:www\.)?youtu\.be$/i
const VIDEO_ID = /^[\w-]{11}$/

export interface YouTubeVideoRef {
  videoId: string
  startSeconds: number
  short: boolean
}

export function parseYouTubeUrl(value: string): YouTubeVideoRef | undefined {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return
  }
  let videoId: string | null = null
  let short = false
  if (YOUTU_BE_HOST.test(url.hostname)) {
    videoId = url.pathname.slice(1)
  } else if (YOUTUBE_HOSTS.test(url.hostname)) {
    const [, first, second] = url.pathname.split('/')
    if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v')
    } else if (first === 'shorts' || first === 'embed' || first === 'live') {
      videoId = second ?? null
      short = first === 'shorts'
    }
  }
  if (!videoId || !VIDEO_ID.test(videoId)) return
  const time = url.searchParams.get('start') ?? url.searchParams.get('t') ?? ''
  return { videoId, startSeconds: parseStartSeconds(time), short }
}

/**
 * `90`, `90s`, `1m30s`, `1h2m3s` to seconds; anything else is `0`.
 */
function parseStartSeconds(value: string): number {
  if (!value) return 0
  if (/^\d+$/.test(value)) return Number(value)
  const matched = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value)
  if (!matched) return 0
  return Number(matched[1] ?? 0) * 3600 + Number(matched[2] ?? 0) * 60 + Number(matched[3] ?? 0)
}

export function getWatchUrl(ref: YouTubeVideoRef): string {
  const time = ref.startSeconds ? `&t=${ref.startSeconds}` : ''
  return `https://www.youtube.com/watch?v=${ref.videoId}${time}`
}

export function getEmbedUrl(ref: YouTubeVideoRef): string {
  const params = new URLSearchParams({ autoplay: '1', playsinline: '1' })
  if (ref.startSeconds) params.set('start', String(ref.startSeconds))
  return `https://www.youtube-nocookie.com/embed/${ref.videoId}?${params}`
}
