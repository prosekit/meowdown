import type { EditorExtension } from '@meowdown/core'
import { canUseRegexLookbehind } from '@prosekit/core'
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

// Open the wikilink menu on either "[[" or "@", and close on "[" or "]".
//
// - "[[" matches "[[", "[[query", "[[multi word query". A space right after
//   "[[" is fine, so "[[ note" keeps the menu open.
// - "@" matches "@", "@query", "@multi word query", but NOT "@ ": a space
//   right after "@" cancels it, so prose like "meet @ 5pm" never opens the
//   menu. The lookbehind also keeps "@" inside a word (e.g. emails) from
//   triggering; the fallback drops only that boundary guard.
const regex = canUseRegexLookbehind()
  ? /(?:\[\[[^[\]]*|(?<!\S)@(?:[^[\]\s][^[\]]*)?)$/u
  : /(?:\[\[[^[\]]*|@(?:[^[\]\s][^[\]]*)?)$/u

function queryFromRegexMatch(match: RegExpExecArray): string {
  return match[0]
    .replace(/^((?:\[\[)|@)/, '')
    .replace(/(?:\]{1,2}\s*)$/, '')
    .trim()
}

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
      queryBuilder={queryFromRegexMatch}
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
              <span className={styles.Label}>{item.label ?? item.target}</span>
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
