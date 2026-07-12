import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, type EditorState, type PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

export interface MarkClickConfig<Payload> {
  key: PluginKey
  /** The click target must sit inside this selector, tested via `closest`. */
  selector: string
  /** The payload for the mark covering `pos`, or `undefined` when the click misses it. */
  findPayloadAt: (state: EditorState, pos: number) => Payload | undefined
  /** Resolve atom mark views from their hidden content holder instead of click coordinates. */
  findPayloadForElement?: (view: EditorView, element: HTMLElement) => Payload | undefined
  /** Fired when a click lands on the mark. */
  onClick: (payload: Payload, event: MouseEvent) => void
  /** Stops native handling (e.g. `<a>` navigation) before firing. */
  preventDefault: boolean
}

/**
 * Shared click plumbing for text-backed marks (wikilinks, Markdown links, tags):
 * a click anywhere on the rendered mark fires `onClick`.
 */
export function defineMarkClickHandler<Payload>(config: MarkClickConfig<Payload>): PlainExtension {
  return definePlugin(
    new Plugin({
      key: config.key,
      props: {
        handleClick: (view, pos, event) => {
          const target = event.target as HTMLElement | null
          const element = target?.closest?.<HTMLElement>(config.selector)
          if (!element) return false
          const payload = config.findPayloadForElement
            ? config.findPayloadForElement(view, element)
            : config.findPayloadAt(view.state, pos)
          if (payload == null) return false
          if (config.preventDefault) event.preventDefault()
          config.onClick(payload, event)
          return true
        },
      },
    }),
  )
}
