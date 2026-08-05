import { definePlugin, union } from '@prosekit/core'
import {
  defineSearchCommands,
  defineSearchQuery,
  getSearchStatus,
} from '@prosekit/extensions/search'
import { Plugin } from '@prosekit/pm/state'
import { Decoration, DecorationSet } from '@prosekit/pm/view'

// Hide and focus mode render syntax runs, link destinations, and link titles at
// font-size 0, so a match landing in one would paint an invisible box. Reveal
// the active match through the same `show` class focus mode uses. Only the
// active one: a query matching twenty destinations must not reflow the page.
const revealActiveMatch = new Plugin({
  props: {
    decorations: (state) => {
      const { from, to, empty } = state.selection
      if (empty || getSearchStatus(state).active === 0) return
      return DecorationSet.create(state.doc, [Decoration.inline(from, to, { class: 'show' })])
    },
  },
})

/**
 * Find over the editor's text. `setSearchQuery` highlights every match and
 * selects the first one at or after the caret; `findNext` and `findPrev` walk
 * the matches and wrap at the document edges. A match sitting in a run the
 * current mark mode hides reveals itself while it is the active one.
 */
export function defineFind() {
  return union(defineSearchQuery(), defineSearchCommands(), definePlugin(revealActiveMatch))
}
