import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, type EditorState, type PluginKey } from '@prosekit/pm/state'

export interface MarkClickConfig<Payload> {
  key: PluginKey
  /** The click target must sit inside this selector, tested via `closest`. */
  selector: string
  /** The payload for the mark covering `pos`, or `undefined` when the click misses it. */
  findPayloadAt: (state: EditorState, pos: number) => Payload | undefined
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
          console.log('DEBUG defineMarkClickHandler target', target)
          console.log('DEBUG defineMarkClickHandler config.selector', config.selector)
          if (!target?.closest?.(config.selector)) return false
          const payload = config.findPayloadAt(view.state, pos)
          if (payload == null) return false
          if (config.preventDefault) event.preventDefault()
          console.log('DEBUG defineMarkClickHandler onClick')
          config.onClick(payload, event)
          return true
        },
      },
    }),
  )
}
