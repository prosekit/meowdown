import { defineCommands, definePlugin, union, type PlainExtension } from '@prosekit/core'
import { defineSearchCommands } from '@prosekit/extensions/search'
import { Plugin, TextSelection, type Command, type EditorState } from '@prosekit/pm/state'
import { Decoration, DecorationSet } from '@prosekit/pm/view'
import {
  getMatchHighlights,
  getSearchState,
  search,
  SearchQuery,
  setSearchState,
} from 'prosemirror-search'

/** The current query's match count and which match the selection sits on. */
export interface SearchStatus {
  /** Total matches of the current query. */
  total: number
  /** One-based position of the selected match; 0 when the selection is not on one. */
  active: number
}

export type SearchStatusHandler = (status: SearchStatus) => void

// `literal` turns off prosemirror-search's escape-sequence handling: a find bar
// takes text, so a typed `\n` is a backslash and an `n`.
function createSearchQuery(query: string): SearchQuery {
  return new SearchQuery({ search: query, literal: true })
}

/**
 * Sets the search query and selects the first match at or after the caret,
 * wrapping to the first match in the document. An empty query clears the
 * highlights and leaves the selection alone. A no-op when the query is
 * unchanged, so a host can call it on every render.
 */
function setSearchQuery(query: string): Command {
  return (state, dispatch) => {
    const searchQuery = createSearchQuery(query)
    if (getSearchState(state)?.query.eq(searchQuery)) return false
    if (dispatch) {
      const transaction = setSearchState(state.tr, searchQuery)
      const match =
        searchQuery.findNext(state, state.selection.from) ?? searchQuery.findNext(state)
      if (match) {
        transaction
          .setSelection(TextSelection.create(transaction.doc, match.from, match.to))
          .scrollIntoView()
      }
      dispatch(transaction)
    }
    return true
  }
}

/** The current query's match count and which match the selection sits on. */
export function getSearchStatus(state: EditorState): SearchStatus {
  const matches = getMatchHighlights(state).find()
  const { from, to } = state.selection
  return {
    total: matches.length,
    active: matches.findIndex((match) => match.from === from && match.to === to) + 1,
  }
}

// Hide and focus mode render syntax runs, link destinations, and link titles at
// font-size 0, so a match landing in one would paint an invisible box. Reveal
// the active match through the same `show` class focus mode uses. Only the
// active one: a query matching twenty destinations must not reflow the page.
const revealActiveMatch = new Plugin({
  props: {
    decorations: (state) => {
      const { from, to, empty } = state.selection
      if (empty) return
      const onMatch = getMatchHighlights(state)
        .find(from, to)
        .some((match) => match.from === from && match.to === to)
      if (!onMatch) return
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
  return union(
    definePlugin([search(), revealActiveMatch]),
    defineSearchCommands(),
    defineCommands({ setSearchQuery }),
  )
}

/** Reports search-status changes so a host can render a match counter. */
export function defineSearchStatusHandler(handler: SearchStatusHandler): PlainExtension {
  return definePlugin(
    new Plugin({
      view: (editorView) => {
        let previous = getSearchStatus(editorView.state)
        return {
          update: (view) => {
            const status = getSearchStatus(view.state)
            if (status.total === previous.total && status.active === previous.active) return
            previous = status
            handler(status)
          },
        }
      },
    }),
  )
}
