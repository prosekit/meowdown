import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'

import { getMarkRangeAt } from './get-mark-range-at.ts'
import type { MdImageAttrs } from './inline-marks.ts'

const imageClickKey = new PluginKey('meowdown-image-click')

interface ImageHit {
  from: number
  to: number
  src: string
  alt: string
}

function findImageAt(state: EditorState, pos: number): ImageHit | undefined {
  const range = getMarkRangeAt(state, pos, 'mdImage')
  if (!range) return
  const { src, alt } = range.mark.attrs as MdImageAttrs
  return { from: range.from, to: range.to, src, alt }
}

/** Payload for {@link ImageClickHandler}. */
export interface ImageClickPayload {
  /** The markdown `src`, exactly as written in `![alt](src)`. */
  src: string
  /** The image alt text. */
  alt: string
  /** The originating click. Read modifier keys or position a popover from it. */
  event: MouseEvent
}

export type ImageClickHandler = (payload: ImageClickPayload) => void

/**
 * Call `onClick` when the user clicks a rendered image preview, with the
 * image's markdown `src`, `alt`, and the originating `MouseEvent`.
 */
export function defineImageClickHandler(onClick: ImageClickHandler): PlainExtension {
  return definePlugin(
    new Plugin({
      key: imageClickKey,
      props: {
        handleClick: (view, _pos, event) => {
          const target = event.target as HTMLElement | null
          const preview = target?.closest?.('.md-image-view-preview')
          if (!preview) return false
          // Resolve the position from the preview's own content holder, not the
          // click's `pos`: a click on the non-editable preview lands on the run
          // boundary, where `getMarkRange` would pick the next adjacent image.
          const content = preview.closest('.md-image-view')?.querySelector('.md-image-view-content')
          if (!content) return false
          const hit = findImageAt(view.state, view.posAtDOM(content, 0))
          if (!hit) return false
          onClick({ src: hit.src, alt: hit.alt, event })
          return true
        },
      },
    }),
  )
}
