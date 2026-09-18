import type { XPostMedia } from '@post-embed/types'

export const X_POST_MEDIA_CLICK = 'meowdown-embed-media-click'

export interface XPostMediaClickDetail {
  /**
   * The activated item. Its URLs already passed the `mediaUrlProtocols` check,
   * and video sources are sorted best first.
   */
  media: XPostMedia
  /**
   * Every displayable item of the same post, in order, for paging.
   */
  items: XPostMedia[]
  /**
   * Position of `media` in `items`.
   */
  index: number
  /**
   * The rendered thumbnail: the photo `<img>`, or the video poster.
   */
  element: HTMLElement
  permalink?: string | undefined
}

export type XPostMediaClickEvent = CustomEvent<XPostMediaClickDetail>

/**
 * Returns false when a listener called `preventDefault()`: the host shows the
 * media itself, so the card must not run its own default.
 */
export function dispatchMediaClick(target: HTMLElement, detail: XPostMediaClickDetail): boolean {
  return target.dispatchEvent(
    new CustomEvent(X_POST_MEDIA_CLICK, {
      detail,
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  )
}
