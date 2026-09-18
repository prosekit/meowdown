import type { XPostMediaClickEvent } from './media-click.ts'
import type { XPostElement } from './x-post.ts'

export type { Resolver } from '../fetch.ts'
export { X_POST_MEDIA_CLICK } from './media-click.ts'
export type { XPostMediaClickDetail, XPostMediaClickEvent } from './media-click.ts'
export { registerXPost } from './register.ts'
export { useXPost } from './x-post.ts'
export type { XPostElement, XPostProps } from './x-post.ts'

declare global {
  interface HTMLElementTagNameMap {
    'meowdown-embed-x': XPostElement
  }
  interface HTMLElementEventMap {
    'meowdown-embed-media-click': XPostMediaClickEvent
  }
}
