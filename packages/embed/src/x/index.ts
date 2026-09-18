import type { XPostElement } from './x-post.ts'

export type { Resolver } from '../fetch.ts'
export { registerXPost } from './register.ts'
export { useXPost } from './x-post.ts'
export type { XPostElement, XPostProps } from './x-post.ts'

declare global {
  interface HTMLElementTagNameMap {
    'meowdown-embed-x': XPostElement
  }
}
