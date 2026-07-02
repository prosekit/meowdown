import { getPendingReplacement, type PendingReplacementMode } from '@meowdown/core'
import {
  useEditor,
  useKeymap,
  type EditorHandle,
  type PendingReplacementResolveHandler,
  type SelectionMenuContext,
  type SelectionMenuSearchHandler,
} from '@meowdown/react'
import { useCallback, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'

/**
 * A selection-menu command for the demo: the result is computed locally from
 * the selected text and streamed into the pending-replacement preview in small
 * chunks, standing in for an AI provider.
 */
interface DemoCommand {
  id: string
  label: string
  detail: string
  mode: PendingReplacementMode
  transform: (selectedText: string) => string
}

/** Leading Markdown block markers: heading, list, blockquote, task box. */
const LEADING_BLOCK_MARKERS = /^\s*(?:(?:[-*+]|\d+[.)]|#{1,6}|>)\s+)*(?:\[[ xX]\]\s+)?/

const DEMO_COMMANDS: DemoCommand[] = [
  {
    id: 'meowify',
    label: 'Meowify',
    detail: 'Every word becomes meow',
    mode: 'replace',
    transform: (selectedText) =>
      selectedText.replaceAll(/\p{L}+/gu, (word) => (/^\p{Lu}/u.test(word) ? 'Meow' : 'meow')),
  },
  {
    id: 'uppercase',
    label: 'Uppercase',
    detail: 'Shout the selection',
    mode: 'replace',
    transform: (selectedText) => selectedText.toUpperCase(),
  },
  {
    id: 'bullets',
    label: 'Turn into bullet list',
    detail: 'One bullet per line',
    mode: 'replace',
    transform: (selectedText) =>
      selectedText
        .split('\n')
        .map((line) => line.replace(LEADING_BLOCK_MARKERS, '').trim())
        .filter((line) => line.length > 0)
        .map((line) => `- ${line}`)
        .join('\n'),
  },
  {
    id: 'summarize',
    label: 'Write a short summary',
    detail: 'Appends below the selection',
    mode: 'append',
    transform: (selectedText) => {
      const wordCount = selectedText.split(/\s+/).filter(Boolean).length
      return `**Summary:** the selection has ${wordCount} ${wordCount === 1 ? 'word' : 'words'} and, in essence, says: meow.`
    },
  },
]

const SEARCH_LATENCY_MS = 150
const STREAM_CHUNK_SIZE = 4
const STREAM_INTERVAL_MS = 30

/** One in-flight (or previewed) demo run, kept for retry. */
interface DemoRun {
  command: DemoCommand
  context: SelectionMenuContext
  cancelled: boolean
}

const ACTION_BUTTON_CLASS =
  'inline-flex cursor-pointer items-center rounded-lg px-2.5 py-1 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'

function DemoReplacementActions({
  mode,
  onRetry,
  onAcceptAs,
}: {
  mode: PendingReplacementMode | null
  onRetry: () => void
  onAcceptAs: (mode: PendingReplacementMode) => void
}) {
  return (
    <>
      <button type="button" className={ACTION_BUTTON_CLASS} onClick={onRetry}>
        Retry
      </button>
      {mode !== null ? (
        <button
          type="button"
          className={ACTION_BUTTON_CLASS}
          onClick={() => onAcceptAs(mode === 'replace' ? 'append' : 'replace')}
        >
          {mode === 'replace' ? 'Insert below' : 'Replace selection'}
        </button>
      ) : null}
    </>
  )
}

export interface SelectionDemoValue {
  onSelectionMenuSearch: SelectionMenuSearchHandler
  pendingReplacementActions: ReactNode
  onPendingReplacementResolve: PendingReplacementResolveHandler
  /** Opens the selection menu; bound to `Mod-Shift-j` by `SelectionMenuShortcut`. */
  openMenu: () => void
}

/**
 * Wires the selection menu and the pending-replacement preview to a set of
 * locally computed demo commands, mirroring how a real host (prompt list,
 * streaming provider call, retry control) would use the editor API.
 */
export function useSelectionDemo(handleRef: RefObject<EditorHandle | null>): SelectionDemoValue {
  const runRef = useRef<DemoRun | undefined>(undefined)
  // The staged placement of the current run — state (not just the ref) so the
  // preview's alternate-placement button can label itself.
  const [runMode, setRunMode] = useState<PendingReplacementMode | null>(null)

  const beginStream = useCallback(
    (command: DemoCommand, context: SelectionMenuContext) => {
      if (runRef.current) runRef.current.cancelled = true
      const run: DemoRun = { command, context, cancelled: false }
      runRef.current = run

      const result = command.transform(context.selectedText)
      let offset = 0
      const timer = setInterval(() => {
        if (run.cancelled || offset >= result.length) {
          clearInterval(timer)
          return
        }
        handleRef.current?.appendPendingReplacementText(
          result.slice(offset, offset + STREAM_CHUNK_SIZE),
        )
        offset += STREAM_CHUNK_SIZE
      }, STREAM_INTERVAL_MS)
    },
    [handleRef],
  )

  const runCommand = useCallback(
    (command: DemoCommand, context: SelectionMenuContext) => {
      const handle = handleRef.current
      if (!handle) return
      const { from, to } = context
      if (!handle.startPendingReplacement({ from, to, mode: command.mode })) return
      setRunMode(command.mode)
      beginStream(command, context)
    },
    [handleRef, beginStream],
  )

  const onSelectionMenuSearch = useCallback<SelectionMenuSearchHandler>(
    async (query) => {
      // Simulate network latency so the menu's loading state shows up.
      await new Promise((resolve) => setTimeout(resolve, SEARCH_LATENCY_MS))
      const needle = query.trim().toLowerCase()
      const commands = needle
        ? DEMO_COMMANDS.filter((command) => command.label.toLowerCase().includes(needle))
        : DEMO_COMMANDS
      return commands.map((command) => ({
        id: command.id,
        label: command.label,
        detail: command.detail,
        onSelect: (context: SelectionMenuContext) => runCommand(command, context),
      }))
    },
    [runCommand],
  )

  const retry = useCallback(() => {
    const run = runRef.current
    const handle = handleRef.current
    if (!run || !handle) return
    // Restage over the current staged range: it tracks edits made while the
    // text streamed, so the offsets captured at menu-open time may be stale.
    const staged = handle.editor ? getPendingReplacement(handle.editor.state) : null
    const range = staged ?? run.context
    if (
      !handle.startPendingReplacement({ from: range.from, to: range.to, mode: run.command.mode })
    ) {
      return
    }
    beginStream(run.command, run.context)
  }, [handleRef, beginStream])

  const acceptAs = useCallback(
    (mode: PendingReplacementMode) => {
      handleRef.current?.acceptPendingReplacement({ mode })
    },
    [handleRef],
  )

  const pendingReplacementActions = useMemo<ReactNode>(
    () => <DemoReplacementActions mode={runMode} onRetry={retry} onAcceptAs={acceptAs} />,
    [runMode, retry, acceptAs],
  )

  const onPendingReplacementResolve = useCallback<PendingReplacementResolveHandler>(() => {
    if (runRef.current) runRef.current.cancelled = true
    runRef.current = undefined
    setRunMode(null)
  }, [])

  const openMenu = useCallback(() => {
    handleRef.current?.openSelectionMenu()
  }, [handleRef])

  return { onSelectionMenuSearch, pendingReplacementActions, onPendingReplacementResolve, openMenu }
}

/**
 * Binds `Mod-Shift-j` inside the editor to open the selection menu. An empty
 * selection lets the key fall through.
 */
export function SelectionMenuShortcut({ onTrigger }: { onTrigger: () => void }) {
  const editor = useEditor()
  const keymap = useMemo(
    () => ({
      'Mod-Shift-j': () => {
        if (editor.state.selection.empty) return false
        onTrigger()
        return true
      },
    }),
    [editor, onTrigger],
  )
  useKeymap(keymap)
  return null
}
