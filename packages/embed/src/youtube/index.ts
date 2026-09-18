import type { YouTubeVideoElement } from './youtube-video.ts'

export type { Resolver } from '../fetch.ts'
export { registerYouTubeVideo } from './register.ts'
export { useYouTubeVideo } from './youtube-video.ts'
export type { YouTubeVideoElement, YouTubeVideoProps } from './youtube-video.ts'

declare global {
  interface HTMLElementTagNameMap {
    'meowdown-embed-youtube': YouTubeVideoElement
  }
}
