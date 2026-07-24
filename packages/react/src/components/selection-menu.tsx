import { Popover } from '@base-ui/react/popover'
import {
  getPendingReplacement,
  getVirtualElementFromRange,
  type EditorExtension,
  type VirtualElement,
} from '@meowdown/core'
import { defineUpdateHandler, isTextSelection } from '@prosekit/core'
import { useEditor, useExtension } from '@prosekit/react'
import { SparklesIcon } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import { useDelayedFlag } from '../hooks/use-delayed-flag.ts'

import styles from './selection-menu.module.css'
import type {
  SelectionMenuContext,
  SelectionMenuItem,
  SelectionMenuSearchHandler,
} from './types.ts'

interface SelectionMenuProps {
  onSelectionMenuSearch: SelectionMenuSearchHandler
  /** The selection the menu is open over; the menu is closed when undefined. */
  context: SelectionMenuContext | undefined
  /** Requests opening over the current selection (from the affordance). */
  onOpen: () => void
  /** Requests closing the menu. */
  onClose: () => void
  /** Shows the floating button on a non-empty selection. On by default. */
  affordance?: boolean
}

interface SelectionSnapshot {
  from: number
  to: number
  /** Whether a floating affordance may anchor to this selection. */
  anchorable: boolean
}

/**
 * A command menu over the current selection: a popover with a filter input and
 * host-supplied rows, anchored to the selected range. Opened imperatively (via
 * `EditorHandle.openSelectionMenu`) or from the selection affordance, a small
 * floating button that appears on a non-empty selection.
 */
export function SelectionMenu({
  onSelectionMenuSearch,
  context,
  onOpen,
  onClose,
  affordance = true,
}: SelectionMenuProps): ReactNode {
  const editor = useEditor<EditorExtension>()
  const [selection, setSelection] = useState<SelectionSnapshot>()

  // Tracks the live selection for the affordance. A pending replacement or a
  // non-text selection (e.g. a selected image) never shows the button.
  useExtension(
    useMemo(() => {
      return defineUpdateHandler((view) => {
        const { from, to, empty } = view.state.selection
        const anchorable =
          !empty && isTextSelection(view.state.selection) && !getPendingReplacement(view.state)
        setSelection((previous) => {
          if (
            previous?.from === from &&
            previous?.to === to &&
            previous?.anchorable === anchorable
          ) {
            return previous
          }
          return { from, to, anchorable }
        })
      })
    }, []),
  )

  const close = useCallback(() => {
    onClose()
    editor.focus()
  }, [onClose, editor])

  const menuAnchor: VirtualElement | undefined = useMemo(() => {
    if (!context) return
    return getVirtualElementFromRange(editor.view, { from: context.from, to: context.to })
  }, [context, editor])

  const open = !!context
  const showAffordance = affordance && !open && !!selection?.anchorable
  const affordanceVisible = useDelayedFlag(showAffordance, 250, 0)

  const affordanceAnchor: VirtualElement | undefined = useMemo(() => {
    if (!showAffordance || !selection) return
    return getVirtualElementFromRange(editor.view, { from: selection.to, to: selection.to })
  }, [showAffordance, selection, editor])

  if (context) {
    return (
      <Popover.Root
        open
        onOpenChange={(next) => {
          if (!next) close()
        }}
      >
        <Popover.Portal>
          <Popover.Positioner
            anchor={menuAnchor}
            side="bottom"
            sideOffset={8}
            className={styles.Positioner}
          >
            <Popover.Popup className={styles.Popup} data-testid="selection-menu" finalFocus={false}>
              <SelectionMenuPopup
                onSelectionMenuSearch={onSelectionMenuSearch}
                context={context}
                onClose={close}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  if (affordanceVisible && showAffordance) {
    return (
      <Popover.Root open onOpenChange={() => {}}>
        <Popover.Portal>
          <Popover.Positioner
            anchor={affordanceAnchor}
            side="bottom"
            sideOffset={4}
            className={styles.AffordancePositioner}
          >
            <Popover.Popup
              className={styles.AffordancePopup}
              data-testid="selection-menu-affordance"
              initialFocus={false}
              finalFocus={false}
            >
              <button
                type="button"
                className={styles.AffordanceButton}
                title="Selection commands"
                aria-label="Selection commands"
                // Keep the editor selection: the button must not take focus.
                onPointerDown={(event) => event.preventDefault()}
                onClick={onOpen}
              >
                <SparklesIcon />
              </button>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return null
}

/** The menu content. Mounted only while the menu is open, so its filter state
 *  resets naturally on close. */
function SelectionMenuPopup({
  onSelectionMenuSearch,
  context,
  onClose,
}: {
  onSelectionMenuSearch: SelectionMenuSearchHandler
  context: SelectionMenuContext
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SelectionMenuItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const fetchItems = useCallback(
    async (query: string, signal: AbortSignal): Promise<void> => {
      if (signal.aborted) return
      setLoading(true)
      const result = await onSelectionMenuSearch(query, context)
      if (signal.aborted) return
      setItems(result)
      setActiveIndex(0)
      setLoading(false)
    },
    [onSelectionMenuSearch, context],
  )

  useEffect(() => {
    const controller = new AbortController()
    // Defer so the effect body doesn't call setState synchronously.
    queueMicrotask(() => {
      void fetchItems(query, controller.signal)
    })
    return () => {
      controller.abort()
    }
  }, [query, fetchItems])

  const selectItem = useCallback(
    (item: SelectionMenuItem) => {
      onClose()
      item.onSelect(context)
    },
    [context, onClose],
  )

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(items.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const item = items[activeIndex]
      if (item) selectItem(item)
    }
  }

  return (
    <>
      <input
        autoFocus
        className={styles.Input}
        value={query}
        placeholder="Filter commands..."
        data-testid="selection-menu-input"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onInputKeyDown}
      />
      <div role="listbox" className={styles.List}>
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={styles.Item}
            data-active={index === activeIndex || undefined}
            onPointerEnter={() => setActiveIndex(index)}
            onClick={() => selectItem(item)}
          >
            <span className={styles.Label}>{item.label}</span>
            {item.detail ? <span className={styles.Detail}>{item.detail}</span> : null}
          </button>
        ))}
        {items.length === 0 ? (
          <div className={styles.Empty}>{loading ? 'Loading...' : 'No commands'}</div>
        ) : null}
      </div>
    </>
  )
}
