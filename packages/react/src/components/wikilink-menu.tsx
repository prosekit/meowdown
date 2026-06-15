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
import type { WikilinkItem, WikilinkSearchHandler } from './types.ts'

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
  const [items, setItems] = useState<WikilinkItem[]>([])
  const [loading, setLoading] = useState(false)

  // Searches notes (sync or async) and applies the result, unless aborted in
  // the meantime.
  const fetchItems = useCallback(
    async (query: string, signal: AbortSignal): Promise<void> => {
      if (signal.aborted) return
      setLoading(true)
      const result = await onWikilinkSearch(query)
      if (signal.aborted) return
      setItems(result)
      setLoading(false)
    },
    [onWikilinkSearch],
  )

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    // Defer so the effect body doesn't call setState synchronously.
    queueMicrotask(() => {
      void fetchItems(query, controller.signal)
    })
    return () => {
      controller.abort()
    }
  }, [open, query, fetchItems])

  return (
    <AutocompleteRoot
      regex={regex}
      filter={returnsTrue}
      onOpenChange={(event) => setOpen(event.detail)}
      onQueryChange={(event) => setQuery(event.detail)}
    >
      <AutocompletePositioner className={styles.Positioner}>
        <AutocompletePopup className={styles.Popup} data-testid="wikilink-menu">
          {items.map((item) => (
            <AutocompleteItem
              key={item.target}
              className={styles.Item}
              onSelect={() => {
                editor.commands.insertText({ text: `[[${item.target}]]` })
                item.onSelect?.()
              }}
            >
              <span>{item.label ?? item.target}</span>
              {item.detail ? <span className={styles.Detail}>{item.detail}</span> : null}
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
