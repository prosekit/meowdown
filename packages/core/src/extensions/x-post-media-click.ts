import { X_POST_MEDIA_CLICK, type XPostMediaClickEvent } from '@meowdown/embed/x'
import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'

const xPostMediaClickKey = new PluginKey('meowdown-x-post-media-click')

/**
 * Receives the `meowdown-embed-media-click` event of an X post card. Its
 * `detail` holds the activated photo or video, its sibling items, and the
 * rendered thumbnail element. Call `event.preventDefault()` to cancel the
 * card's own default (open the photo URL, play the video in place).
 */
export type XPostMediaClickHandler = (event: XPostMediaClickEvent) => void

/**
 * Call `onClick` when the user activates a photo or video inside an X post
 * card.
 */
export function defineXPostMediaClickHandler(
  getOnClick?: (state: EditorState) => XPostMediaClickHandler | undefined,
): PlainExtension {
  return definePlugin(
    new Plugin({
      key: xPostMediaClickKey,
      props: {
        handleDOMEvents: {
          [X_POST_MEDIA_CLICK]: (view, event) => {
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
