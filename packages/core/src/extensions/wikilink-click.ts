import type { PlainExtension } from '@prosekit/core'
import { PluginKey, type EditorState } from '@prosekit/pm/state'

import { getMarkRangeAt } from './get-mark-range-at.ts'
import type { MdWikilinkSourceAttrs } from './inline-marks.ts'
import { defineMarkClickHandler } from './mark-click.ts'

const wikilinkClickKey = new PluginKey('meowdown-wikilink-click')

export interface WikilinkHit {
  from: number
  to: number
  target: string
}

/** The wikilink covering `pos`, found via the `mdWikilinkSource` mark. Exported for tests. */
export function findWikilinkAt(state: EditorState, pos: number): WikilinkHit | undefined {
  const range = getMarkRangeAt(state, pos, 'mdWikilinkSource')
  if (!range) return
  const { target } = range.mark.attrs as MdWikilinkSourceAttrs
  return { from: range.from, to: range.to, target }
}

export interface ParsedWikilink {
  target: string
  display: string
}

/** Splits `[[target]]`/`[[target|alias]]` into its target and display label (the alias, or empty). */
export function parseWikilink(text: string): ParsedWikilink {
  const inner = text.replace(/^\[\[/u, '').replace(/\]\]$/u, '')
  const pipe = inner.indexOf('|')
  if (pipe < 0) return { target: inner.trim(), display: '' }
  return { target: inner.slice(0, pipe).trim(), display: inner.slice(pipe + 1).trim() }
}

export interface WikilinkClickPayload {
  target: string
  event: MouseEvent
}

export type WikilinkClickHandler = (payload: WikilinkClickPayload) => void

export function defineWikilinkClickHandler(onClick: WikilinkClickHandler): PlainExtension {
  return defineMarkClickHandler<string>({
    key: wikilinkClickKey,
    selector: '.md-wikilink-label, .md-wikilink-source',
    preventDefault: false,
    findHitAt: (state, pos) => {
      const hit = findWikilinkAt(state, pos)
      return hit ? { from: hit.from, to: hit.to, payload: hit.target } : undefined
    },
    onClick: (target, event) => onClick({ target, event }),
  })
}
