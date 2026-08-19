import type { EditorMode } from '@meowdown/react'
import { useCallback, useEffect, useState } from 'react'

interface ModeOption {
  value: EditorMode
  label: string
  description: string
}

export const MODES: ModeOption[] = [
  {
    value: 'focus',
    label: 'Focus',
    description: 'Syntax stays hidden and peeks out only where your cursor rests.',
  },
  {
    value: 'show',
    label: 'Show',
    description: 'Every Markdown character stays visible, dimmed in soft grey.',
  },
  {
    value: 'hide',
    label: 'Hide',
    description: 'Markdown characters disappear for a clean, fully rendered view.',
  },
]

const MODE_STORAGE_KEY = 'meowdown:mode'
const MODE_QUERY_KEY = 'mode'

function isEditorMode(value: string | null): value is EditorMode {
  return MODES.some((option) => option.value === value)
}

// The URL query outranks sessionStorage, so a shared `?mode=` link pins the
// mode regardless of what the visitor picked before.
function readInitialMode(): EditorMode {
  const queryMode = new URLSearchParams(window.location.search).get(MODE_QUERY_KEY)
  if (queryMode != null) {
    if (isEditorMode(queryMode)) {
      return queryMode
    }
    console.warn(`[meowdown] Invalid mode in URL query: ${queryMode}`)
  }
  const storedMode = sessionStorage.getItem(MODE_STORAGE_KEY)
  return isEditorMode(storedMode) ? storedMode : 'focus'
}

function writeModeQuery(mode: EditorMode): void {
  const url = new URL(window.location.href)
  url.searchParams.set(MODE_QUERY_KEY, mode)
  history.replaceState(null, '', url)
}

export function useEditorMode() {
  const [mode, setModeState] = useState<EditorMode>('focus')

  // The URL query and sessionStorage are read after mount, so the hook can
  // render on the server.
  useEffect(() => {
    setModeState(readInitialMode())
  }, [])

  const setMode = useCallback((nextMode: EditorMode) => {
    setModeState(nextMode)
    sessionStorage.setItem(MODE_STORAGE_KEY, nextMode)
    writeModeQuery(nextMode)
  }, [])

  const activeMode = MODES.find((option) => option.value === mode) ?? MODES[0]

  return { mode, setMode, activeMode }
}
