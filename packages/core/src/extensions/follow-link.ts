import { definePlugin, isApple, Priority, withPriority, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey } from '@prosekit/pm/state'

import { getIsComposing } from '../utils/composition.ts'

import { getSelectedAtomRange } from './atom-mark-navigation.ts'
import type { FileClickHandler } from './file-click.ts'
import { findFileAt } from './file-click.ts'
import { getLinkUnitAt } from './get-link-unit-at.ts'
import type { LinkClickHandler } from './link-click.ts'
import type { TagClickHandler } from './tag-click.ts'
import { findTagAt } from './tag-click.ts'
import type { WikilinkClickHandler } from './wikilink-click.ts'
import { findWikilinkAt } from './wikilink-click.ts'

const followLinkKey = new PluginKey('meowdown-follow-link')

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
        const mod = isApple ? event.metaKey : event.ctrlKey
        if (!mod && !selectedAtom) {
          return false
        }

        // Resolve inside the selected unit, not at its edge: either edge may
        // also touch an adjacent unit, and edge positions prefer the
        // neighbour to the right.
        const pos = selectedAtom ? selectedAtom.from + 1 : state.selection.head

        const wikilink = handlers.onWikilinkClick && findWikilinkAt(state, pos)
        if (wikilink) {
          handlers.onWikilinkClick?.({ target: wikilink.target, event })
          return true
        }

        const tag = handlers.onTagClick && findTagAt(state, pos)
        if (tag) {
          handlers.onTagClick?.({ tag: tag.tag, event })
          return true
        }

        // A claimed file link carries only the `mdFile` mark, so the link
        // lookup below never sees it.
        const file = handlers.onFileClick && findFileAt(state, pos)
        if (file) {
          handlers.onFileClick?.({ href: file.href, name: file.name, event })
          return true
        }

        const link = handlers.onLinkClick && getLinkUnitAt(state, pos)
        if (link) {
          handlers.onLinkClick?.({ href: link.href, event })
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
 * the same handlers a click does. Off a link, `Mod-Enter` falls through so
 * the list keymap keeps cycling checkbox tasks; off a selected unit, `Enter`
 * falls through to the regular split. High priority puts this ahead of every
 * keymap binding.
 */
export function defineFollowLinkHandler(handlers: FollowLinkHandlers): PlainExtension {
  return withPriority(definePlugin(createFollowLinkPlugin(handlers)), Priority.high)
}
