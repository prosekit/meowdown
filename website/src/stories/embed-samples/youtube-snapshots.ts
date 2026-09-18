import type { YouTubeVideo } from '@post-embed/types'

export type YouTubeSnapshot =
  | 'basic'
  | 'long-title'
  | 'short'
  | 'start-time'
  | 'no-author'
  | 'missing'

export function createYouTubeSnapshot(name: YouTubeSnapshot): YouTubeVideo | null {
  if (name === 'missing') return null
  const video: YouTubeVideo = {
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    title: 'Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film',
    author_name: 'Blender',
    author_url: 'https://www.youtube.com/@BlenderOfficial',
    thumbnail_url: new URL('/embed/media/poster.svg', window.location.origin).href,
    thumbnail_width: 480,
    thumbnail_height: 360,
    width: 200,
    height: 113,
  }
  if (name === 'long-title') {
    video.title = `${video.title} `.repeat(4).trim()
  }
  if (name === 'short') video.url = 'https://www.youtube.com/shorts/aqz-KE-bpKQ'
  if (name === 'start-time') {
    video.url = 'https://youtu.be/aqz-KE-bpKQ?t=1m30s'
  }
  if (name === 'no-author') {
    video.author_name = ''
    video.author_url = ''
  }
  return video
}
