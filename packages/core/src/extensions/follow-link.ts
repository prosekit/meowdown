import { definePlugin, Priority, withPriority, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'

import { getIsComposing } from '../utils/composition.ts'
import { isModEvent } from '../utils/is-mod-event.ts'

import { getSelectedAtomRange } from './atom-mark-navigation.ts'
import type { FileClickHandler } from './file-click.ts'
import { findFileAt } from './file-click.ts'
import { getLinkUnitAt, type LinkUnit } from './get-link-unit-at.ts'
import type { LinkClickHandler } from './link-click.ts'
import type { TagClickHandler } from './tag-click.ts'
import { findTagAt } from './tag-click.ts'
import type { WikilinkClickHandler } from './wikilink-click.ts'
import { findWikilinkAt } from './wikilink-click.ts'

const followLinkKey = new PluginKey('meowdown-follow-link')

// The link unit at `pos`, flattened to carry its own range so the caret
// filter can treat it like the other finds.
function findLinkAt(
  state: EditorState,
  pos: number,
): (LinkUnit & { from: number; to: number }) | undefined {
  const unit = getLinkUnitAt(state, pos)
  return unit && { ...unit, from: unit.unit.from, to: unit.unit.to }
}

export interface FollowLinkHandlers {
  onWikilinkClick?: WikilinkClickHandler
  onTagClick?: TagClickHandler
  onFileClick?: FileClickHandler
  onLinkClick?: LinkClickHandler
}

function createFollowLinkPlugin(handlers: FollowLinkHandlers) {
  return new Plugin({
    key: followLinkKey,
    props: {
      handleKeyDown: (view, event) => {
        if (getIsComposing() || event.key !== 'Enter' || event.shiftKey) {
          return false
        }

        const { state } = view
        const selectedAtom = getSelectedAtomRange(state)
        // Off a selected atom unit, plain Enter stays a regular split.
        const trigger = isModEvent(event)
        if (!trigger && !selectedAtom) {
          return false
        }

        // A spare mod only exists on a selected-unit follow: a caret follow
        // consumed its modifier as the trigger.
        const mod = selectedAtom !== undefined && trigger

        // Resolve inside the selected unit, not at its edge: either edge may
        // also touch an adjacent unit, and edge positions prefer the
        // neighbour to the right.
        const pos = selectedAtom ? selectedAtom.from + 1 : state.selection.head

        // A caret follow needs the caret strictly inside the unit: the finds
        // use touching semantics (for clicks), so an edge position would
        // follow a link the caret is merely next to. A selected unit already
        // proved itself.
        const inside = <T extends { from: number; to: number }>(
          hit: T | undefined,
        ): T | undefined =>
          hit && (selectedAtom !== undefined || (hit.from < pos && pos < hit.to)) ? hit : undefined

        const wikilink = handlers.onWikilinkClick && inside(findWikilinkAt(state, pos))
        if (wikilink) {
          handlers.onWikilinkClick?.({ target: wikilink.target, event, mod })
          return true
        }

        // A claimed file link carries only the `mdFile` mark, so the link
        // lookup below never sees it.
        const file = handlers.onFileClick && inside(findFileAt(state, pos))
        if (file) {
          handlers.onFileClick?.({ href: file.href, name: file.name, event, mod })
          return true
        }

        const tag = handlers.onTagClick && inside(findTagAt(state, pos))
        if (tag) {
          handlers.onTagClick?.({ tag: tag.tag, event, mod })
          return true
        }

        const link = handlers.onLinkClick && inside(findLinkAt(state, pos))
        if (link) {
          handlers.onLinkClick?.({ href: link.href, event, mod })
          return true
        }

        return false
      },
    },
  })
}

/**
 * Binds `Mod-Enter` to follow the wikilink, tag, file pill, or Markdown link
 * under the caret, and plain `Enter` to follow a selected atom unit, firing
 * the same handlers a click does. "Under the caret" means strictly inside
 * the unit: a caret merely touching a unit's edge is next to it, not on it.
 * Off a link, `Mod-Enter` falls through so the list keymap keeps cycling
 * checkbox tasks; off a selected unit, `Enter` falls through to the regular
 * split. High priority puts this ahead of every keymap binding.
 *
 * A selected-unit follow reports `mod: true` when the platform's mod key
 * (`⌘` on Apple, `Ctrl` elsewhere) was held beyond its plain-`Enter` trigger;
 * a caret follow always reports `mod: false`, its mod key being the trigger
 * itself.
 */
export function defineFollowLinkHandler(handlers: FollowLinkHandlers): PlainExtension {
  return withPriority(definePlugin(createFollowLinkPlugin(handlers)), Priority.high)
}
