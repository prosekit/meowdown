import { definePlugin, Priority, withPriority, type PlainExtension } from '@prosekit/core'
import { Plugin } from '@prosekit/pm/state'

import { linkAt, wikilinkAt, type LinkHit, type WikilinkHit } from './link-hit.ts'

/** Context passed to an {@link LinkClickHandler}. */
export interface LinkClickContext extends LinkHit {
  /** The originating click, for new-tab / button / modifier inspection. */
  event: MouseEvent
}

/** Context passed to an {@link WikilinkClickHandler}. */
export interface WikilinkClickContext extends WikilinkHit {
  /** The originating click, for new-tab / button / modifier inspection. */
  event: MouseEvent
  /** Whether the target resolves to an existing note, when the host knows. */
  resolved?: boolean
}

export type LinkClickHandler = (context: LinkClickContext) => void
export type WikilinkClickHandler = (context: WikilinkClickContext) => void

function isModClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey
}

/**
 * Fires `handler` on Mod+click (Cmd/Ctrl) of a rendered Markdown link. A plain
 * click is left alone so the caret lands in the link for editing. Adds a
 * `data-link-click` attribute so CSS can scope a pointer cursor to "active".
 */
export function defineLinkClickHandler(handler: LinkClickHandler): PlainExtension {
  const plugin = new Plugin({
    props: {
      attributes: { 'data-link-click': '' },
      handleClick(view, pos, event) {
        const target = event.target as Element | null
        if (!target?.closest('a') || target.closest('pre, code')) return false
        if (!isModClick(event)) return false
        const hit = linkAt(view.state, pos)
        if (!hit) return false
        handler({ ...hit, event })
        return true
      },
    },
  })
  // Win the `handleClick` ordering against `defineModClickPrevention`, which
  // returns `true` for any Mod+click. ProseMirror runs handlers in plugin
  // order and the first `true` wins.
  return withPriority(definePlugin(plugin), Priority.high)
}

/**
 * Fires `handler` on Mod+click (Cmd/Ctrl) of a rendered wikilink. A plain click
 * is left alone so the caret lands in the link for editing. Adds a
 * `data-wikilink-click` attribute so CSS can scope a pointer cursor to "active".
 */
export function defineWikilinkClickHandler(handler: WikilinkClickHandler): PlainExtension {
  const plugin = new Plugin({
    props: {
      attributes: { 'data-wikilink-click': '' },
      handleClick(view, pos, event) {
        const target = event.target as Element | null
        if (!target?.closest('.md-wikilink')) return false
        if (!isModClick(event)) return false
        const hit = wikilinkAt(view.state, pos)
        if (!hit) return false
        handler({ ...hit, event })
        return true
      },
    },
  })
  return withPriority(definePlugin(plugin), Priority.high)
}
