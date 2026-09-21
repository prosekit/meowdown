import type { YouTubeVideo } from '@post-embed/types'

export const YOUTUBE_VIDEO_CLICK = 'meowdown-embed-youtube-click'

export interface YouTubeVideoClickDetail {
  /**
   * The snapshot the card rendered.
   */
  video: YouTubeVideo
  videoId: string
  /**
   * Where playback starts, from the `t` or `start` parameter of the URL.
   */
  startSeconds: number
  /**
   * A Short, which plays in portrait.
   */
  short: boolean
  /**
   * The player page for an `<iframe>`. It starts playing as soon as it loads.
   */
  embedUrl: string
  /**
   * The rendered thumbnail: the poster `<img>`, or the poster itself when the
   * snapshot has no thumbnail.
   */
  element: HTMLElement
}

export type YouTubeVideoClickEvent = CustomEvent<YouTubeVideoClickDetail>

/**
 * Returns false when a listener called `preventDefault()`: the host plays the
 * video itself, so the card must not run its own default.
 */
export function dispatchVideoClick(target: HTMLElement, detail: YouTubeVideoClickDetail): boolean {
  return target.dispatchEvent(
    new CustomEvent(YOUTUBE_VIDEO_CLICK, {
      detail,
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  )
}
