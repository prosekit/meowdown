import type { EditorExtension } from '@meowdown/core'
import { useEditor } from '@prosekit/react'
import {
  AutocompleteEmpty,
  AutocompleteItem,
  AutocompletePopup,
  AutocompletePositioner,
  AutocompleteRoot,
} from '@prosekit/react/autocomplete'
import { useCallback, useEffect, useState } from 'react'

import { returnsTrue } from '../utils/returns-true.ts'

import styles from './autocomplete-menu.module.css'
import type { WikilinkSearchHandler } from './types.ts'

// Match "[[", "[[query", "[[multi word query": opens right after "[[" and
// closes once "]" or "[" is typed. No lookbehind: after "[[[", the trailing
// "[[" still starts a valid wikilink.
const regex = /\[\[[^[\]]*$/u

interface WikilinkMenuProps {
  onWikilinkSearch: WikilinkSearchHandler
}

// Deliberately not shared with TagMenu: the two menus are expected to
// diverge, so the duplication is kept until the differences are clear.

export function WikilinkMenu({ onWikilinkSearch }: WikilinkMenuProps) {
  const editor = useEditor<EditorExtension>()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Searches notes (sync or async) and applies the result, unless aborted in
  // the meantime.
  const fetchNotes = useCallback(
    async (query: string, signal: AbortSignal): Promise<void> => {
      if (signal.aborted) return
      setLoading(true)
      const result = await onWikilinkSearch(query)
      if (signal.aborted) return
      setNotes(result)
      setLoading(false)
    },
    [onWikilinkSearch],
  )

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    // Defer so the effect body doesn't call setState synchronously.
    queueMicrotask(() => {
      void fetchNotes(query, controller.signal)
    })
    return () => {
      controller.abort()
    }
  }, [open, query, fetchNotes])

  return (
    <AutocompleteRoot
      regex={regex}
      filter={returnsTrue}
      onOpenChange={(event) => setOpen(event.detail)}
      onQueryChange={(event) => setQuery(event.detail)}
    >
      <AutocompletePositioner className={styles.Positioner}>
        <AutocompletePopup className={styles.Popup} data-testid="wikilink-menu">
          {notes.map((note) => (
            <AutocompleteItem
              key={note}
              className={styles.Item}
              onSelect={() => editor.commands.insertText({ text: `[[${note}]]` })}
            >
              {note}
            </AutocompleteItem>
          ))}
          <AutocompleteEmpty className={styles.Item}>
            {loading ? 'Loading...' : 'No notes found'}
          </AutocompleteEmpty>
        </AutocompletePopup>
      </AutocompletePositioner>
    </AutocompleteRoot>
  )
}
