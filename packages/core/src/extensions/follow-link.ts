import {
  definePlugin,
  Priority,
  withPriority,
  type MarkRange,
  type PlainExtension,
} from '@prosekit/core'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'

import { getIsComposing } from '../utils/composition.ts'
import { isModEvent } from '../utils/is-mod-event.ts'

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
        const mod = isModEvent(event)

        if (!selectedAtom && !mod) {
          return
        }

        if (selectedAtom && handlerAtomMarkTrigger(state, event, handlers, mod, selectedAtom)) {
          return true
        }

        if (handlerTextMarkTrigger(state, event, handlers, mod)) {
          return true
        }

        return false
      },
    },
  })
}

function handlerAtomMarkTrigger(
  state: EditorState,
  event: KeyboardEvent,
  handlers: FollowLinkHandlers,
  mod: boolean,
  selectedAtom: MarkRange,
) {
  // Resolve inside the selected unit, not at its edge: either edge may
  // also touch an adjacent unit, and edge positions prefer the
  // neighbour to the right.
  const pos = selectedAtom.from + 1

  const { onWikilinkClick, onFileClick } = handlers

  const wikilink = onWikilinkClick && findWikilinkAt(state, pos)
  if (wikilink) {
    onWikilinkClick({ target: wikilink.target, event, mod })
    return true
  }

  // A claimed file link carries only the `mdFile` mark, so the link
  // lookup below never sees it.
  const file = onFileClick && findFileAt(state, pos)
  if (file) {
    onFileClick({ href: file.href, name: file.name, event, mod })
    return true
  }
}

function handlerTextMarkTrigger(
  state: EditorState,
  event: KeyboardEvent,
  handlers: FollowLinkHandlers,
  mod: boolean,
): boolean | undefined {
  const pos = state.selection.head

  const { onTagClick, onLinkClick } = handlers

  const tag = onTagClick && findTagAt(state, pos)
  if (tag && tag.from < pos && pos < tag.to) {
    onTagClick({ tag: tag.tag, event, mod })
    return true
  }

  const link = onLinkClick && getLinkUnitAt(state, pos)
  if (link && link.unit.from < pos && pos < link.unit.to) {
    onLinkClick({ href: link.href, event, mod })
    return true
  }
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
