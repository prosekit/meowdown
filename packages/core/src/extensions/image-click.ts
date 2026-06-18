import { definePlugin, getMarkRange, getMarkType, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'

import type { MdImageViewAttrs } from './inline-marks.ts'
import type { MarkName } from './mark-names.ts'

const imageClickKey = new PluginKey('meowdown-image-click')

interface ImageHit {
  from: number
  to: number
  src: string
  alt: string
}

/** The image covering `pos`, found via the `mdImageSource` run. */
function imageAt(state: EditorState, pos: number): ImageHit | undefined {
  const $pos = state.doc.resolve(pos)
  if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return
  const range = getMarkRange($pos, 'mdImageSource' satisfies MarkName)
  if (!range) return
  // `mdImageView` carries `src`/`alt` and sits on the run's final character.
  const anchor = state.doc.nodeAt(range.to - 1)
  const viewType = getMarkType(state.schema, 'mdImageView' satisfies MarkName)
  const view = anchor?.marks.find((mark) => mark.type === viewType)
  if (!view) return
  const { src, alt } = view.attrs as MdImageViewAttrs
  return { from: range.from, to: range.to, src, alt }
}

export interface ImageClickPayload {
  /** The markdown `src`, exactly as written in `![alt](src)`. */
  src: string
  /** The image alt text. */
  alt: string
  /** The originating click. Read modifier keys or position a popover from it. */
  event: MouseEvent
}

export type ImageClickHandler = (payload: ImageClickPayload) => void

export function defineImageClickHandler(onClick: ImageClickHandler): PlainExtension {
  return definePlugin(
    new Plugin({
      key: imageClickKey,
      props: {
        handleClick: (view, _pos, event) => {
          const target = event.target as HTMLElement | null
          // Match the rendered preview, not `.md-image-view`: a click on the raw
          // `![alt](url)` source text (visible in show mode) must still place the
          // caret.
          const preview = target?.closest?.('.md-image-preview')
          if (!preview) return false
          // Resolve the position from the preview's own content holder, not the
          // click's `pos`: a click on the non-editable preview lands on the run
          // boundary, where `getMarkRange` would pick the next adjacent image.
          const content = preview.closest('.md-image-view')?.querySelector('.md-image-view-content')
          if (!content) return false
          const hit = imageAt(view.state, view.posAtDOM(content, 0))
          if (!hit) return false
          onClick({ src: hit.src, alt: hit.alt, event })
          return true
        },
      },
    }),
  )
}
