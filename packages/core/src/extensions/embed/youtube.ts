import type { EmbedMatcher } from './types.ts'

const YOUTUBE_HOSTS = /^(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com)$/i
const YOUTU_BE_HOST = /^(?:www\.)?youtu\.be$/i
// A YouTube video id is a 64-bit value encoded as base64url, so it is always
// 11 characters from the `[A-Za-z0-9_-]` alphabet.
// Source: https://wiki.archiveteam.org/index.php/YouTube/Technical_details
const VIDEO_ID = /^[\w-]{11}$/

/** Extract `{ videoId, startSeconds? }` from any watch/shorts/embed/live/`youtu.be` URL. */
function parseYouTube(src: string): { videoId: string; startSeconds?: number } | undefined {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return undefined
  }
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
  if (!videoId || !VIDEO_ID.test(videoId)) return undefined
  const timeParam = url.searchParams.get('start') ?? url.searchParams.get('t')
  const startSeconds = timeParam ? parseStartSeconds(timeParam) : undefined
  return { videoId, startSeconds }
}

/** `90`, `90s`, `1m30s`, `1h2m3s` to seconds. */
function parseStartSeconds(value: string): number | undefined {
  if (/^\d+$/.test(value)) return Number(value)
  const matched = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value)
  if (!matched || (!matched[1] && !matched[2] && !matched[3])) return undefined
  return Number(matched[1] ?? 0) * 3600 + Number(matched[2] ?? 0) * 60 + Number(matched[3] ?? 0)
}

export const matchYouTube: EmbedMatcher = (src) => {
  const parsed = parseYouTube(src)
  if (!parsed) return
  const query = parsed.startSeconds ? `?start=${parsed.startSeconds}` : ''
  return {
    key: `youtube:${parsed.videoId}:${parsed.startSeconds ?? 0}`,
    render: () => {
      const iframe = document.createElement('iframe')
      // Privacy-enhanced player; no tracking cookies until the user plays.
      iframe.src = `https://www.youtube-nocookie.com/embed/${parsed.videoId}${query}`
      iframe.title = 'YouTube video'
      iframe.className = 'md-embed md-embed-youtube'
      iframe.dataset.testid = 'youtube-embed'
      iframe.loading = 'lazy'
      iframe.referrerPolicy = 'strict-origin-when-cross-origin'
      iframe.setAttribute('frameborder', '0')
      iframe.allow =
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen'
      iframe.allowFullscreen = true
      return iframe
    },
  }
}
