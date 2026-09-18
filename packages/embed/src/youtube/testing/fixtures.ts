import type { YouTubeVideo } from '@post-embed/types'

export function createVideo(
  url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=90',
): YouTubeVideo {
  return {
    url,
    title: 'Big Buck Bunny',
    author_name: 'Blender',
    author_url: 'https://www.youtube.com/@BlenderOfficial',
    thumbnail_url: new URL('./poster.svg?no-inline', import.meta.url).href,
    thumbnail_width: 480,
    thumbnail_height: 360,
    width: 200,
    height: 113,
  }
}
