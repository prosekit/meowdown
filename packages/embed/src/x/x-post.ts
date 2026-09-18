import {
  defineCustomElement,
  defineProps,
  type HostElement,
  type State,
  useEffect as useHostEffect,
} from '@aria-ui/core'
import { parseXPost, parseXPostId } from '@post-embed/schema'
import type { XPost as XPostSnapshot } from '@post-embed/types'
import el from 'crelt'

import { type FetchProps, useFetch } from '../fetch.ts'
import { getRootContainer } from '../root.ts'

import { renderPost } from './render-post.ts'

export interface XPostProps extends FetchProps<XPostSnapshot> {
  mediaUrlProtocols: readonly string[] | null
}

export interface XPostElement extends HTMLElement, XPostProps {}

/** @internal */
export function useXPost(host: HostElement, props: State<XPostProps>): void {
  const { fetched, pending } = useFetch(host, props, 'X post')

  useHostEffect(host, () => {
    host.dataset.meowdownEmbed = 'x'
    const container = getRootContainer(host)
    const data = props.data.get() ?? fetched.get()
    const result = data == null ? undefined : parseXPost(data)

    if (result?.issues) {
      console.error('[meowdown] Invalid X post data:', result.issues)
    }

    const protocols = props.mediaUrlProtocols.get()
    const url = props.url.get()
    const value = result && !result.issues ? result.value : undefined
    // Validate that resolver output belongs to the requested permalink.
    const valid = value && (props.data.get() != null || !url || parseXPostId(url) === value.id)
    container.replaceChildren(valid ? renderPost(value, protocols) : renderFallback(pending.get()))
    return () => {
      for (const video of container.querySelectorAll('video')) video.pause()
    }
  })
}

function renderFallback(pending: boolean): HTMLElement {
  return el(
    'article',
    pending ? { 'data-fallback': '', 'data-pending': '' } : { 'data-fallback': '' },
    el('header', { 'data-author': '' }, el('bdi', {}, 'X post')),
    el('p', { 'data-body': '' }, pending ? 'Loading this post…' : 'This post is unavailable.'),
    pending ? null : el('footer', { 'data-footer': '' }, 'No saved post could be displayed.'),
  )
}

export const XPost = defineCustomElement(
  useXPost,
  defineProps<XPostProps>({
    data: { default: null, attribute: false },
    url: { default: null, attribute: false },
    resolver: { default: null, attribute: false },
    mediaUrlProtocols: { default: null, attribute: false },
  }),
)
