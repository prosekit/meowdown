import { getIsComposing, type SearchStatus } from '@meowdown/core'
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
  'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 disabled:pointer-events-none disabled:opacity-35 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100'

export interface FindDemoValue {
  /**
   * Goes to the editor as `searchQuery`; empty while the bar is closed.
   */
  query: string
  onSearchChange: (status: SearchStatus) => void
  /**
   * Opens the bar; bound to `Mod-f` by `FindShortcut`.
   */
  openBar: () => void
  /**
   * The bar itself, rendered by the demo over the editor.
   */
  bar: ReactElement | null
}

/**
 * A browser-style find bar for the demo: `Command-F` opens it, Enter and Shift-Enter
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
      if (getIsComposing()) return
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

  const hasQuery = text.length > 0
  const canNavigate = status.total > 0

  const bar = open ? (
    <div className="absolute top-3 right-4 z-20 flex items-center gap-1 rounded-full border border-stone-200/80 bg-white/95 py-1 pr-1 pl-3 shadow-lg shadow-stone-900/5 backdrop-blur dark:border-stone-700/70 dark:bg-stone-900/95">
      <span className="i-lucide-search size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
      <input
        ref={inputRef}
        autoFocus
        aria-label="Find in document"
        className="w-36 bg-transparent text-sm text-stone-700 outline-none placeholder:text-stone-400 dark:text-stone-200"
        placeholder="Find"
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {hasQuery && (
        <span
          role="status"
          aria-live="polite"
          className="shrink-0 text-xs tabular-nums text-stone-400"
        >
          {status.active}/{status.total}
        </span>
      )}
      <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-stone-200 dark:bg-stone-700" />
      <button
        type="button"
        aria-label="Previous match"
        title="Previous match (Shift Enter)"
        className={FIND_BUTTON_CLASS}
        disabled={!canNavigate}
        onClick={() => handleRef.current?.findPrevious()}
      >
        <span className="i-lucide-chevron-up size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Next match"
        title="Next match (Enter)"
        className={FIND_BUTTON_CLASS}
        disabled={!canNavigate}
        onClick={() => handleRef.current?.findNext()}
      >
        <span className="i-lucide-chevron-down size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Close find"
        title="Close (Escape)"
        className={FIND_BUTTON_CLASS}
        onClick={close}
      >
        <span className="i-lucide-x size-4" aria-hidden="true" />
      </button>
    </div>
  ) : null

  return { query: open ? text : '', onSearchChange: setStatus, openBar, bar }
}

/**
 * Opens the demo find bar on `Mod-f`, consuming the browser's own shortcut.
 */
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
