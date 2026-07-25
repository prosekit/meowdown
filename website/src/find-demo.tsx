import type { SearchStatus } from '@meowdown/core'
import { useKeymap, type EditorHandle } from '@meowdown/react'
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
} from 'react'

const NO_MATCHES: SearchStatus = { total: 0, active: 0 }

const FIND_BUTTON_CLASS =
  'flex size-6 cursor-pointer items-center justify-center rounded text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100'

export interface FindDemoValue {
  /** Goes to the editor as `searchQuery`; empty while the bar is closed. */
  query: string
  onSearchChange: (status: SearchStatus) => void
  /** Opens the bar; bound to `Mod-f` by `FindShortcut`. */
  openBar: () => void
  /** The bar itself, rendered by the demo over the editor. */
  bar: ReactElement | null
}

/**
 * A browser-style find bar for the demo: `⌘F` opens it, Enter and Shift-Enter
 * walk the matches, and Escape closes it and hands focus back to the editor.
 */
export function useFindDemo(handleRef: RefObject<EditorHandle | null>): FindDemoValue {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [status, setStatus] = useState<SearchStatus>(NO_MATCHES)
  const inputRef = useRef<HTMLInputElement>(null)

  const openBar = useCallback(() => {
    setOpen(true)
    inputRef.current?.select()
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    handleRef.current?.focus()
  }, [handleRef])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.nativeEvent.isComposing) return
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        if (event.shiftKey) handleRef.current?.findPrevious()
        else handleRef.current?.findNext()
      }
    },
    [close, handleRef],
  )

  const bar = open ? (
    <div className="absolute top-3 right-4 z-20 flex items-center gap-0.5 rounded-lg border border-stone-200 bg-white px-2 py-1 shadow-lg dark:border-stone-700 dark:bg-stone-900">
      <input
        ref={inputRef}
        autoFocus
        aria-label="Find in document"
        className="w-44 bg-transparent text-sm text-stone-700 outline-none placeholder:text-stone-400 dark:text-stone-200"
        placeholder="Find"
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span className="mr-1 min-w-12 text-center text-xs tabular-nums text-stone-400">
        {status.active} / {status.total}
      </span>
      <button
        type="button"
        aria-label="Previous match"
        title="Previous match (Shift Enter)"
        className={FIND_BUTTON_CLASS}
        onClick={() => handleRef.current?.findPrevious()}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="Next match"
        title="Next match (Enter)"
        className={FIND_BUTTON_CLASS}
        onClick={() => handleRef.current?.findNext()}
      >
        ↓
      </button>
      <button
        type="button"
        aria-label="Close find"
        title="Close (Escape)"
        className={FIND_BUTTON_CLASS}
        onClick={close}
      >
        ✕
      </button>
    </div>
  ) : null

  return { query: open ? text : '', onSearchChange: setStatus, openBar, bar }
}

/** Opens the demo find bar on `Mod-f`, consuming the browser's own shortcut. */
export function FindShortcut({ onTrigger }: { onTrigger: () => void }) {
  const keymap = useMemo(
    () => ({
      'Mod-f': () => {
        onTrigger()
        return true
      },
    }),
    [onTrigger],
  )
  useKeymap(keymap)
  return null
}
