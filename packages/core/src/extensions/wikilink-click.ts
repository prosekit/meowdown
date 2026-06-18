import { definePlugin, getMarkRange, isApple, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'

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
  let selectionBefore: { from: number; to: number; empty: boolean } | undefined
  return definePlugin(
    new Plugin({
      key: wikilinkClickKey,
      props: {
        handleDOMEvents: {
          // The browser moves the caret on click, so snapshot the selection first.
          mousedown: (view) => {
            const { from, to, empty } = view.state.selection
            selectionBefore = { from, to, empty }
            return false
          },
        },
        handleClick: (view, pos, event) => {
          const onLink = (event.target as HTMLElement | null)?.closest?.('.md-wikilink')
          if (!onLink) return false
          const link = wikilinkAt(view.state, pos)
          if (!link) return false
          const modClick = isApple ? event.metaKey : event.ctrlKey
          // A plain click inside a link the caret already sits in just places the caret.
          if (
            !modClick &&
            selectionBefore?.empty &&
            selectionBefore.from >= link.from &&
            selectionBefore.to <= link.to
          ) {
            return false
          }
          onClick({ target: link.target, event })
          return true
        },
      },
    }),
  )
}
