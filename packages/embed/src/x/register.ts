import { registerCustomElement } from '@aria-ui/core'

import { XPost } from './x-post.ts'

export function registerXPost(name = 'meowdown-embed-x'): void {
  registerCustomElement(name, class extends XPost {})
}
