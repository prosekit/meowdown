import { getMarkRange, type PlainExtension } from '@prosekit/core'
import { PluginKey, type EditorState } from '@prosekit/pm/state'

import { defineMarkClickHandler } from './mark-click.ts'
import type { MarkName } from './mark-names.ts'

const wikilinkClickKey = new PluginKey('meowdown-wikilink-click')

export interface WikilinkHit {
  from: number
  to: number
  target: string
}

/** The wikilink covering `pos`, found via the `mdWikilink` mark. Exported for tests. */
export function wikilinkAt(state: EditorState, pos: number): WikilinkHit | undefined {
  const $pos = state.doc.resolve(pos)
  if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return
  const range = getMarkRange($pos, 'mdWikilink' satisfies MarkName)
  if (!range) return
  return {
    from: range.from,
    to: range.to,
    target: parseWikilinkTarget(state.doc.textBetween(range.from, range.to)),
  }
}

/** Extracts the target from `[[target]]` or `[[target|alias]]`. Exported for tests. */
export function parseWikilinkTarget(text: string): string {
  const inner = text.replace(/^\[\[/u, '').replace(/\]\]$/u, '')
  const pipe = inner.indexOf('|')
  return (pipe >= 0 ? inner.slice(0, pipe) : inner).trim()
}

export interface WikilinkClickPayload {
  target: string
  event: MouseEvent
}

export type WikilinkClickHandler = (payload: WikilinkClickPayload) => void

export function defineWikilinkClickHandler(onClick: WikilinkClickHandler): PlainExtension {
  return defineMarkClickHandler({
    key: wikilinkClickKey,
    selector: '.md-wikilink',
    hitAt: (state, pos) => {
      const hit = wikilinkAt(state, pos)
      return hit ? { from: hit.from, to: hit.to, payload: hit.target } : undefined
    },
    onClick: (target, event) => onClick({ target, event }),
  })
}
