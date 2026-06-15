import { definePlugin, getMarkType, isApple, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'

const wikilinkClickKey = new PluginKey('meowdown-wikilink-click')

export interface WikilinkHit {
  from: number
  to: number
  target: string
}

/** The wikilink covering `pos`, found via the `mdWikilink` mark. Exported for tests. */
export function wikilinkAt(state: EditorState, pos: number): WikilinkHit | undefined {
  const mark = getMarkType(state.schema, 'mdWikilink')
  const $pos = state.doc.resolve(pos)
  const parent = $pos.parent
  if (!parent.isTextblock || parent.type.spec.code) return

  // The mark spans several text nodes (the brackets also carry `mdMark`), so
  // walk the contiguous run of `mdWikilink` children that contains `pos`.
  const start = $pos.start()
  let runFrom = -1
  let runTo = -1
  let hit: { from: number; to: number } | undefined
  let offset = 0
  parent.forEach((child) => {
    const childFrom = start + offset
    offset += child.nodeSize
    const childTo = start + offset
    if (mark.isInSet(child.marks)) {
      if (runFrom < 0) runFrom = childFrom
      runTo = childTo
    } else {
      if (runFrom >= 0 && runFrom <= pos && pos <= runTo) hit = { from: runFrom, to: runTo }
      runFrom = -1
    }
  })
  if (runFrom >= 0 && runFrom <= pos && pos <= runTo) hit = { from: runFrom, to: runTo }
  if (!hit) return
  return {
    from: hit.from,
    to: hit.to,
    target: parseWikilinkTarget(state.doc.textBetween(hit.from, hit.to)),
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
