import type { YouTubeVideoClickEvent } from './video-click.ts'
import type { YouTubeVideoElement } from './youtube-video.ts'

export type { Resolver } from '../fetch.ts'
export { registerYouTubeVideo } from './register.ts'
export { YOUTUBE_VIDEO_CLICK } from './video-click.ts'
export type { YouTubeVideoClickDetail, YouTubeVideoClickEvent } from './video-click.ts'
export { useYouTubeVideo } from './youtube-video.ts'
export type { YouTubeVideoElement, YouTubeVideoProps } from './youtube-video.ts'

declare global {
  interface HTMLElementTagNameMap {
    'meowdown-embed-youtube': YouTubeVideoElement
  }
  interface HTMLElementEventMap {
    'meowdown-embed-youtube-click': YouTubeVideoClickEvent
  }
}
