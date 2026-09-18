import { registerCustomElement } from '@aria-ui/core'

import { YouTubeVideoCustomElement } from './youtube-video.ts'

export function registerYouTubeVideo(name = 'meowdown-embed-youtube'): void {
  registerCustomElement(name, class extends YouTubeVideoCustomElement {})
}
