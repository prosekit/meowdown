import type { YouTubeVideo } from '@post-embed/types'

/**
 * A minimal saved video: no thumbnail URL, so rendering it never requests the
 * network.
 */
export function createYouTubeVideo(title = 'Big Buck Bunny'): YouTubeVideo {
  return {
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    title,
    author_name: 'Blender',
    author_url: 'https://www.youtube.com/@Blender',
    thumbnail_url: '',
    thumbnail_width: 480,
    thumbnail_height: 360,
    width: 200,
    height: 113,
  }
}
