import {
  defineCustomElement,
  defineProps,
  type HostElement,
  type State,
  useEffect as useHostEffect,
} from '@aria-ui/core'
import { parseYouTubeVideo } from '@post-embed/schema'
import type { YouTubeVideo } from '@post-embed/types'
import el from 'crelt'

import { type FetchProps, useFetch } from '../fetch.ts'
import { getRootContainer } from '../root.ts'

import { parseYouTubeUrl } from './parse-url.ts'
import { renderVideo } from './render-video.ts'

export interface YouTubeVideoProps extends FetchProps<YouTubeVideo> {
  /**
   * `link` (default) opens the watch page; `inline` swaps in the YouTube
   * player after a click on the poster.
   */
  playback: string
}

export interface YouTubeVideoElement extends HTMLElement, YouTubeVideoProps {}

/** @internal */
export function useYouTubeVideo(host: HostElement, props: State<YouTubeVideoProps>): void {
  const { fetched, pending } = useFetch(host, props, 'YouTube video')

  useHostEffect(host, () => {
    host.dataset.meowdownEmbed = 'youtube'
    const container = getRootContainer(host)
    const data = props.data.get() ?? fetched.get()
    const playback = props.playback.get() === 'inline' ? 'inline' : 'link'
    const result = data == null ? undefined : parseYouTubeVideo(data)

    if (result?.issues) {
      console.error('[meowdown] Invalid YouTube video data:', result.issues)
    }

    const ref = result && !result.issues ? parseYouTubeUrl(result.value.url) : undefined

    container.replaceChildren(
      result && !result.issues && ref
        ? renderVideo(result.value, ref, playback)
        : renderFallback(pending.get()),
    )
  })
}

function renderFallback(pending: boolean): HTMLElement {
  return el(
    'article',
    pending ? { 'data-fallback': '', 'data-pending': '' } : { 'data-fallback': '' },
    el('div', { 'data-details': '' }, el('span', { 'data-title': '' }, 'YouTube video')),
    el('p', { 'data-body': '' }, pending ? 'Loading this video…' : 'This video is unavailable.'),
    pending ? null : el('footer', { 'data-footer': '' }, 'No saved video could be displayed.'),
  )
}

export const YouTubeVideoCustomElement = defineCustomElement(
  useYouTubeVideo,
  defineProps<YouTubeVideoProps>({
    data: { default: null, attribute: false },
    url: { default: null, attribute: false },
    resolver: { default: null, attribute: false },
    playback: { default: 'link', attribute: 'playback', type: 'string' },
  }),
)
