import { YOUTUBE_VIDEO_CLICK, type YouTubeVideoClickEvent } from '@meowdown/embed/youtube'
import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'

const youTubeVideoClickKey = new PluginKey('meowdown-youtube-video-click')

/**
 * Receives the `meowdown-embed-youtube-click` event of a YouTube card. Its
 * `detail` holds the video, the player URL, and the rendered thumbnail
 * element. Call `event.preventDefault()` to cancel the card's own default
 * (play the video in place).
 */
export type YouTubeVideoClickHandler = (event: YouTubeVideoClickEvent) => void

/**
 * Call `onClick` when the user activates the poster of a YouTube card.
 */
export function defineYouTubeVideoClickHandler(
  getOnClick?: (state: EditorState) => YouTubeVideoClickHandler | undefined,
): PlainExtension {
  return definePlugin(
    new Plugin({
      key: youTubeVideoClickKey,
      props: {
        handleDOMEvents: {
          [YOUTUBE_VIDEO_CLICK]: (view, event) => {
            const handler = getOnClick?.(view.state)
            if (!handler) return false
            handler(event)
            return event.defaultPrevented
          },
        },
      },
    }),
  )
}
