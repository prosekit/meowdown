import type { XPostMediaClickDetail } from '@meowdown/embed/x'
import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'

const xPostMediaClickKey = new PluginKey('meowdown-x-post-media-click')

/**
 * Payload for {@link XPostMediaClickHandler}: the activated photo or video of
 * an X post card, its sibling items, and the rendered thumbnail element.
 */
export type XPostMediaClickPayload = XPostMediaClickDetail

export type XPostMediaClickHandler = (payload: XPostMediaClickPayload) => void

/**
 * Call `onClick` when the user activates a photo or video inside an X post
 * card. With a handler the card's own default (open the photo URL, play the
 * video in place) is cancelled, so the host can show the media itself.
 */
export function defineXPostMediaClickHandler(
  getOnClick?: (state: EditorState) => XPostMediaClickHandler | undefined,
): PlainExtension {
  return definePlugin(
    new Plugin({
      key: xPostMediaClickKey,
      props: {
        handleDOMEvents: {
          'meowdown-embed-media-click': (view, event) => {
            const handler = getOnClick?.(view.state)
            if (!handler) return false
            event.preventDefault()
            handler(event.detail)
            return true
          },
        },
      },
    }),
  )
}
