import { isSelectionInTableCell, type EditorExtension, type TypedEditor } from '@meowdown/core'
import { canUseRegexLookbehind } from '@prosekit/core'
import { useEditor, useEditorDerivedValue } from '@prosekit/react'
import {
  AutocompleteEmpty,
  AutocompleteItem,
  AutocompletePopup,
  AutocompletePositioner,
  AutocompleteRoot,
} from '@prosekit/react/autocomplete'
import { useCallback, useEffect, useState } from 'react'

import { formatNowTime, type TimeFormat } from '../utils/date-format.ts'

import styles from './autocomplete-menu.module.css'
import type { SlashMenuItem, SlashMenuSearchHandler } from './types.ts'

// Match inputs like "/", "/table", "/heading 1" etc. Do not match "/ heading".
const regex = canUseRegexLookbehind() ? /(?<!\S)\/(\S.*)?$/u : /\/(\S.*)?$/u

interface BuiltinSlashMenuItemProps {
  label: string
  kbd?: string
  onSelect: VoidFunction
}

function BuiltinSlashMenuItem({ label, kbd, onSelect }: BuiltinSlashMenuItemProps) {
  return (
    <AutocompleteItem className={styles.Item} onSelect={onSelect}>
      <span>{label}</span>
      {kbd && <kbd>{kbd}</kbd>}
    </AutocompleteItem>
  )
}

interface SlashMenuProps {
  /** The clock format the "Now" item inserts. Defaults to '12'. */
  timeFormat?: TimeFormat

  /** Adds host items after the built-in ones. See `EditorProps.onSlashMenuSearch`. */
  onSlashMenuSearch?: SlashMenuSearchHandler
}

// Hoisted so its identity is stable across renders, as useEditorDerivedValue
// requires.
function selectionInTableCell(editor: TypedEditor): boolean {
  return isSelectionInTableCell(editor.state)
}

export function SlashMenu({ timeFormat = '12', onSlashMenuSearch }: SlashMenuProps) {
  const editor = useEditor<EditorExtension>()

  // A table cell holds inline content only, so the block-creating items below
  // are no-ops there. Hide them and offer only the inline "Now" item.
  const inTableCell = useEditorDerivedValue(selectionInTableCell)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hostItems, setHostItems] = useState<SlashMenuItem[]>([])

  // Searches host items (sync or async) and applies the result, unless
  // aborted in the meantime.
  const fetchHostItems = useCallback(
    async (query: string, signal: AbortSignal): Promise<void> => {
      if (!onSlashMenuSearch || signal.aborted) return
      const result = await onSlashMenuSearch(query)
      if (signal.aborted) return
      setHostItems(result)
    },
    [onSlashMenuSearch],
  )

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    // Defer so the effect body doesn't call setState synchronously.
    queueMicrotask(() => {
      void fetchHostItems(query, controller.signal)
    })
    return () => {
      controller.abort()
    }
  }, [open, query, fetchHostItems])

  return (
    <AutocompleteRoot
      regex={regex}
      onOpenChange={(event) => setOpen(event.detail)}
      onQueryChange={(event) => setQuery(event.detail)}
    >
      <AutocompletePositioner className={styles.Positioner}>
        <AutocompletePopup className={styles.Popup} data-testid="slash-menu">
          {!inTableCell && (
            <>
              <BuiltinSlashMenuItem
                label="Heading 1"
                kbd="#"
                onSelect={() => editor.commands.setHeading({ level: 1 })}
              />
              <BuiltinSlashMenuItem
                label="Heading 2"
                kbd="##"
                onSelect={() => editor.commands.setHeading({ level: 2 })}
              />
              <BuiltinSlashMenuItem
                label="Heading 3"
                kbd="###"
                onSelect={() => editor.commands.setHeading({ level: 3 })}
              />
              <BuiltinSlashMenuItem
                label="Heading 4"
                kbd="####"
                onSelect={() => editor.commands.setHeading({ level: 4 })}
              />
              <BuiltinSlashMenuItem
                label="Blockquote"
                kbd=">"
                onSelect={() => editor.commands.setBlockquote()}
              />
              <BuiltinSlashMenuItem
                label="Bullet list"
                kbd="-"
                onSelect={() => editor.commands.wrapInList({ kind: 'bullet' })}
              />
              <BuiltinSlashMenuItem
                label="Ordered list"
                kbd="1."
                onSelect={() => editor.commands.wrapInList({ kind: 'ordered' })}
              />
              {/* The user-facing copy ("Task list" / "Checkbox list") intentionally
                  differs from the internal command names (`wrapInCircleTask` /
                  `wrapInSquareTask`, "circle / square checkbox task"). */}
              <BuiltinSlashMenuItem
                label="Task list"
                kbd="+ [ ] "
                onSelect={() => editor.commands.wrapInCircleTask()}
              />
              <BuiltinSlashMenuItem
                label="Checkbox list"
                kbd="- [ ] "
                onSelect={() => editor.commands.wrapInSquareTask()}
              />
              <BuiltinSlashMenuItem
                label="Code block"
                kbd="```"
                onSelect={() => editor.commands.setCodeBlock()}
              />
              <BuiltinSlashMenuItem
                label="Table"
                onSelect={() => editor.commands.insertTable({ row: 3, col: 3, header: true })}
              />
            </>
          )}
          <BuiltinSlashMenuItem
            label="Now"
            onSelect={() => editor.commands.insertText({ text: formatNowTime(timeFormat) })}
          />
          {/* Host items come after the built-ins. The autocomplete removes the
              typed `/query` text and closes the menu before `onSelect` runs,
              so a handler can insert straight at the cursor. Filtering matches
              `value` (the label) the same way the built-in items are matched. */}
          {hostItems.map((item) => (
            <AutocompleteItem
              key={item.id ?? item.label}
              value={item.label}
              className={styles.Item}
              onSelect={item.onSelect}
            >
              <span className={styles.Label}>{item.label}</span>
              {item.detail ? <span className={styles.Detail}>{item.detail}</span> : null}
            </AutocompleteItem>
          ))}
          <AutocompleteEmpty className={styles.Item}>No results</AutocompleteEmpty>
        </AutocompletePopup>
      </AutocompletePositioner>
    </AutocompleteRoot>
  )
}
