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
import type { TagItem, TagSearchHandler } from './types.ts'

// Match "#tag" with at least one character, so typing a heading ("# ") never
// opens the menu. Do not match "abc#def".
const regex = canUseRegexLookbehind() ? /(?<!\S)#[\da-z]+$/iu : /#[\da-z]+$/iu

interface TagMenuProps {
  onTagSearch: TagSearchHandler
}

// Deliberately not shared with WikilinkMenu: the two menus are expected to
// diverge, so the duplication is kept until the differences are clear.

export function TagMenu({ onTagSearch }: TagMenuProps) {
  const editor = useEditor<EditorExtension>()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<TagItem[]>([])
  const [loading, setLoading] = useState(false)

  // Searches tags (sync or async) and applies the result, unless aborted in
  // the meantime.
  const fetchItems = useCallback(
    async (query: string, signal: AbortSignal): Promise<void> => {
      if (signal.aborted) return
      setLoading(true)
      const result = await onTagSearch(query)
      if (signal.aborted) return
      setItems(result)
      setLoading(false)
    },
    [onTagSearch],
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
        <AutocompletePopup className={styles.Popup} data-testid="tag-menu">
          {items.map((item) => (
            <AutocompleteItem
              key={item.tag}
              className={styles.Item}
              onSelect={() => {
                editor.commands.insertText({ text: `#${item.tag} ` })
                item.onSelect?.()
              }}
            >
              <span>{item.label ?? `#${item.tag}`}</span>
              {item.detail ? <span className={styles.Detail}>{item.detail}</span> : null}
            </AutocompleteItem>
          ))}
          <AutocompleteEmpty className={styles.Item}>
            {loading ? 'Loading...' : 'No tags found'}
          </AutocompleteEmpty>
        </AutocompletePopup>
      </AutocompletePositioner>
    </AutocompleteRoot>
  )
}
