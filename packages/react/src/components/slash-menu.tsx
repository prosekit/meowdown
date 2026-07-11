import {
  buildFileMarkdown,
  isSelectionInTableCell,
  type EditorExtension,
  type FilePasteOptions,
  type FileSaveErrorHandler,
  type TypedEditor,
} from '@meowdown/core'
import { canUseRegexLookbehind } from '@prosekit/core'
import { useEditor, useEditorDerivedValue } from '@prosekit/react'
import {
  AutocompleteEmpty,
  AutocompleteItem,
  AutocompletePopup,
  AutocompletePositioner,
  AutocompleteRoot,
} from '@prosekit/react/autocomplete'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'

import { formatNowTime, type TimeFormat } from '../utils/date-format.ts'

import styles from './autocomplete-menu.module.css'
import type { SlashMenuItem, SlashMenuSearchHandler } from './types.ts'

// Match inputs like "/", "/table", "/heading 1" etc. Do not match "/ heading".
const regex = new RegExp(
  (canUseRegexLookbehind() ? String.raw`(?<!\S)` : '') + String.raw`\/(\S.*)?$`,
  'u',
)

const defaultOnFileSaveError: FileSaveErrorHandler = (error) => {
  console.error('[meowdown] failed to save attached file:', error)
}

interface SlashMenuItemProps {
  label: string
  keywords?: string[]
  detail?: string
  kbd?: string
  onSelect: VoidFunction
}

function SlashMenuItem({ label, keywords, detail, kbd, onSelect }: SlashMenuItemProps) {
  return (
    <AutocompleteItem
      value={[label, ...(keywords ?? [])].join(' ')}
      className={styles.Item}
      onSelect={onSelect}
    >
      <span className={detail ? styles.Label : undefined}>{label}</span>
      {detail ? <span className={styles.Detail}>{detail}</span> : null}
      {kbd && <kbd>{kbd}</kbd>}
    </AutocompleteItem>
  )
}

interface SlashMenuProps {
  /** The clock format the "Now" item inserts. Defaults to '12'. */
  timeFormat?: TimeFormat

  /** Adds host items after the built-in ones. See `EditorProps.onSlashMenuSearch`. */
  onSlashMenuSearch?: SlashMenuSearchHandler

  /** Persists files selected from the "Attach file" item. See `EditorProps.onFilePaste`. */
  onFilePaste?: FilePasteOptions['onFilePaste']

  /** Called when an attached file fails to persist. See `EditorProps.onFileSaveError`. */
  onFileSaveError?: FilePasteOptions['onFileSaveError']
}

// Hoisted so its identity is stable across renders, as useEditorDerivedValue
// requires.
function selectionInTableCell(editor: TypedEditor): boolean {
  return isSelectionInTableCell(editor.state)
}

export function SlashMenu({
  timeFormat = '12',
  onSlashMenuSearch,
  onFilePaste,
  onFileSaveError,
}: SlashMenuProps) {
  const editor = useEditor<EditorExtension>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // A table cell holds inline content only, so the block-creating items below
  // are no-ops there. Hide them and offer only inline items.
  const inTableCell = useEditorDerivedValue(selectionInTableCell)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hostItems, setHostItems] = useState<SlashMenuItem[]>([])

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

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const input = event.currentTarget
      const files = Array.from(input.files ?? [])
      input.value = ''
      if (!onFilePaste || files.length === 0) return

      const onSaveError = onFileSaveError ?? defaultOnFileSaveError
      const markdown: string[] = []
      for (const file of files) {
        try {
          const destination = await onFilePaste(file)
          if (destination) markdown.push(buildFileMarkdown(file, destination))
        } catch (error) {
          onSaveError(error, file)
        }
      }

      if (markdown.length === 0) return
      editor.focus()
      editor.commands.insertText({ text: markdown.join('\n') })
    },
    [editor, onFilePaste, onFileSaveError],
  )

  return (
    <AutocompleteRoot
      regex={regex}
      onOpenChange={(event) => setOpen(event.detail)}
      onQueryChange={(event) => setQuery(event.detail)}
    >
      {onFilePaste ? (
        <input
          ref={fileInputRef}
          data-testid="slash-menu-file-input"
          type="file"
          multiple
          hidden
          onChange={handleFileInputChange}
        />
      ) : null}
      <AutocompletePositioner className={styles.Positioner}>
        <AutocompletePopup className={styles.Popup} data-testid="slash-menu">
          {!inTableCell && (
            <>
              <SlashMenuItem
                label="Heading 1"
                kbd="#"
                onSelect={() => editor.commands.setHeading({ level: 1 })}
              />
              <SlashMenuItem
                label="Heading 2"
                kbd="##"
                onSelect={() => editor.commands.setHeading({ level: 2 })}
              />
              <SlashMenuItem
                label="Heading 3"
                kbd="###"
                onSelect={() => editor.commands.setHeading({ level: 3 })}
              />
              <SlashMenuItem
                label="Heading 4"
                kbd="####"
                onSelect={() => editor.commands.setHeading({ level: 4 })}
              />
              <SlashMenuItem
                label="Blockquote"
                kbd=">"
                onSelect={() => editor.commands.setBlockquote()}
              />
              <SlashMenuItem
                label="Bullet list"
                kbd="-"
                onSelect={() => editor.commands.wrapInList({ kind: 'bullet' })}
              />
              <SlashMenuItem
                label="Ordered list"
                kbd="1."
                onSelect={() => editor.commands.wrapInList({ kind: 'ordered' })}
              />
              {/* The user-facing copy ("Task list" / "Checkbox list") intentionally
                  differs from the internal command names (`wrapInCircleTask` /
                  `wrapInSquareTask`, "circle / square checkbox task"). */}
              <SlashMenuItem
                label="Task list"
                kbd="+ [ ] "
                onSelect={() => editor.commands.wrapInCircleTask()}
              />
              <SlashMenuItem
                label="Checkbox list"
                kbd="- [ ] "
                onSelect={() => editor.commands.wrapInSquareTask()}
              />
              <SlashMenuItem
                label="Code block"
                kbd="```"
                onSelect={() => editor.commands.setCodeBlock()}
              />
              <SlashMenuItem
                label="Math"
                keywords={['latex']}
                kbd="```math"
                onSelect={() => editor.commands.insertMarkdown('```math\n```')}
              />
              <SlashMenuItem
                label="Table"
                onSelect={() => editor.commands.insertTable({ row: 3, col: 3, header: true })}
              />
            </>
          )}
          <SlashMenuItem
            label="Now"
            onSelect={() => editor.commands.insertText({ text: formatNowTime(timeFormat) })}
          />
          {onFilePaste ? (
            <SlashMenuItem
              label="Attach file"
              keywords={['attachment', 'file', 'upload']}
              onSelect={openFilePicker}
            />
          ) : null}
          {hostItems.map((item) => (
            <SlashMenuItem
              key={item.id ?? item.label}
              label={item.label}
              keywords={item.keywords}
              detail={item.detail}
              onSelect={item.onSelect}
            />
          ))}
          <AutocompleteEmpty className={styles.Item}>No results</AutocompleteEmpty>
        </AutocompletePopup>
      </AutocompletePositioner>
    </AutocompleteRoot>
  )
}
