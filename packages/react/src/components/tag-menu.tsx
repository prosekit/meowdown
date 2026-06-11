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

import type { TagSearchHandler } from './types.ts'

// Match "#tag" with at least one character, so typing a heading ("# ") never
// opens the menu. Do not match "abc#def".
const regex = canUseRegexLookbehind() ? /(?<!\S)#[\da-z]+$/iu : /#[\da-z]+$/iu

interface TagMenuProps {
  onTagSearch: TagSearchHandler
}

export function TagMenu({ onTagSearch }: TagMenuProps) {
  const editor = useEditor<EditorExtension>()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Searches tags (sync or async) and applies the result, unless aborted in
  // the meantime.
  const fetchTags = useCallback(
    async (query: string, signal: AbortSignal): Promise<void> => {
      if (signal.aborted) return
      setLoading(true)
      const result = await onTagSearch(query)
      if (signal.aborted) return
      setTags(result)
      setLoading(false)
    },
    [onTagSearch],
  )

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    // Defer so the effect body doesn't call setState synchronously.
    queueMicrotask(() => {
      void fetchTags(query, controller.signal)
    })
    return () => {
      controller.abort()
    }
  }, [open, query, fetchTags])

  return (
    <AutocompleteRoot
      regex={regex}
      filter={returnsTrue}
      onOpenChange={(event) => setOpen(event.detail)}
      onQueryChange={(event) => setQuery(event.detail)}
    >
      <AutocompletePositioner className="meowdown-autocomplete-menu-positioner">
        <AutocompletePopup className="meowdown-autocomplete-menu" data-testid="tag-menu">
          {tags.map((tag) => (
            <AutocompleteItem
              key={tag}
              className="meowdown-autocomplete-menu-item"
              onSelect={() => editor.commands.insertText({ text: `#${tag} ` })}
            >
              #{tag}
            </AutocompleteItem>
          ))}
          <AutocompleteEmpty className="meowdown-autocomplete-menu-item">
            {loading ? 'Loading...' : 'No tags found'}
          </AutocompleteEmpty>
        </AutocompletePopup>
      </AutocompletePositioner>
    </AutocompleteRoot>
  )
}
