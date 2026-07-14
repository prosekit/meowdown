import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'

import { getMarkRangeAt } from './get-mark-range-at.ts'
import type { MdFileAttrs } from './inline-marks.ts'

const fileClickKey = new PluginKey('meowdown-file-click')

interface FileHit {
  href: string
  name: string
}

export function findFileAt(state: EditorState, pos: number): FileHit | undefined {
  const range = getMarkRangeAt(state, pos, 'mdFile')
  if (!range) return
  const { href, name } = range.mark.attrs as MdFileAttrs
  return { href, name }
}

/** Payload for {@link FileClickHandler}. */
export interface FileClickPayload {
  /** The resolved destination from `[name](href)` or a claimed `![[target]]`. */
  href: string
  /** The file name shown on the pill. */
  name: string
  /**
   * The originating click, or the `Mod-Enter` key press that followed the
   * pill. Read modifier keys or position a popover from it.
   */
  event: MouseEvent | KeyboardEvent
}

export type FileClickHandler = (payload: FileClickPayload) => void

/**
 * Call `onClick` when the user clicks a rendered file pill, with the file's
 * `href`, `name`, and the originating `MouseEvent`. The host decides what a
 * click does (e.g. open the file in the OS default app).
 */
export function defineFileClickHandler(onClick: FileClickHandler): PlainExtension {
  return definePlugin(
    new Plugin({
      key: fileClickKey,
      props: {
        handleClick: (view, _pos, event) => {
          const target = event.target as HTMLElement | null
          const preview = target?.closest?.('.md-file-view-preview')
          if (!preview) return false
          // Resolve the position from the pill's own content holder, not the
          // click's `pos`: a click on the non-editable pill lands on the run
          // boundary, where `getMarkRange` would pick the next adjacent file.
          const content = preview.closest('.md-file-view')?.querySelector('.md-file-view-content')
          if (!content) return false
          const hit = findFileAt(view.state, view.posAtDOM(content, 0))
          if (!hit) return false
          onClick({ href: hit.href, name: hit.name, event })
          return true
        },
      },
    }),
  )
}
