import { definePlugin, isApple, type PlainExtension } from '@prosekit/core'
import { Plugin, type EditorState, type PluginKey } from '@prosekit/pm/state'

interface MarkClickHit<Payload> {
  from: number
  to: number
  payload: Payload
}

export interface MarkClickConfig<Payload> {
  key: PluginKey
  /** The click target must sit inside this selector, tested via `closest`. */
  selector: string
  /** The mark hit covering `pos`, or `undefined` when the click misses it. */
  hitAt: (state: EditorState, pos: number) => MarkClickHit<Payload> | undefined
  /** Fired once the click passes the caret-edit guard below. */
  onClick: (payload: Payload, event: MouseEvent) => void
  /** Stops native handling (e.g. `<a>` navigation) before firing. */
  preventDefault?: boolean
}

/**
 * Shared click plumbing for text-backed link marks (wikilinks, Markdown links).
 * A plain click inside a mark the caret already sits in just places the caret,
 * so the run stays editable; `Mod`-click always fires.
 */
export function defineMarkClickHandler<Payload>(config: MarkClickConfig<Payload>): PlainExtension {
  let selectionBefore: { from: number; to: number; empty: boolean } | undefined
  return definePlugin(
    new Plugin({
      key: config.key,
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
          const target = event.target as HTMLElement | null
          if (!target?.closest?.(config.selector)) return false
          const hit = config.hitAt(view.state, pos)
          if (!hit) return false
          const modClick = isApple ? event.metaKey : event.ctrlKey
          if (
            !modClick &&
            selectionBefore?.empty &&
            selectionBefore.from >= hit.from &&
            selectionBefore.to <= hit.to
          ) {
            return false
          }
          if (config.preventDefault) event.preventDefault()
          config.onClick(hit.payload, event)
          return true
        },
      },
    }),
  )
}
