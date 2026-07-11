import type { PlainExtension } from '@prosekit/core'
import { PluginKey, type EditorState } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { getMarkRangeAt } from './get-mark-range-at.ts'
import type { MdWikilinkAttrs } from './inline-marks.ts'
import { defineMarkClickHandler } from './mark-click.ts'

const wikilinkClickKey = new PluginKey('meowdown-wikilink-click')

export interface WikilinkHit {
  from: number
  to: number
  target: string
}

/** Exported for tests. */
export function findWikilinkAt(state: EditorState, pos: number): WikilinkHit | undefined {
  const range = getMarkRangeAt(state, pos, 'mdWikilink')
  if (!range) return
  const { target } = range.mark.attrs as MdWikilinkAttrs
  return { from: range.from, to: range.to, target }
}

/**
 * Resolve the wiki link represented by a visible mark-view element.
 *
 * The preview label is non-editable and can be much wider than its Markdown
 * source. Resolving from click coordinates therefore risks landing on the
 * next adjacent mark; the hidden content holder has the exact source position.
 */
export function findWikilinkForElement(
  view: EditorView,
  element: HTMLElement,
): WikilinkHit | undefined {
  const content = element
    .closest('.md-wikilink-view')
    ?.querySelector<HTMLElement>('.md-wikilink-view-content')
  if (!content) return
  return findWikilinkAt(view.state, view.posAtDOM(content, 0))
}

export interface WikilinkClickPayload {
  target: string
  /** The originating click, or the `Mod-Enter` key press that followed the link. */
  event: MouseEvent | KeyboardEvent
}

export type WikilinkClickHandler = (payload: WikilinkClickPayload) => void

export function defineWikilinkClickHandler(onClick: WikilinkClickHandler): PlainExtension {
  return defineMarkClickHandler<string>({
    key: wikilinkClickKey,
    selector: '.md-wikilink-view-preview',
    preventDefault: false,
    findPayloadAt: (state, pos) => findWikilinkAt(state, pos)?.target,
    findPayloadForElement: (view, element) => findWikilinkForElement(view, element)?.target,
    onClick: (target, event) => onClick({ target, event }),
  })
}
