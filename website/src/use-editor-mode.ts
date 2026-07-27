import { useCallback, useState } from 'react'

import type { DemoMode } from './components/demo-editor.tsx'

interface ModeOption {
  value: DemoMode
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
  {
    value: 'source',
    label: 'Source',
    description: 'Raw Markdown text.',
  },
  {
    value: 'readonly',
    label: 'Readonly',
    description: 'A read-only render of the document, with no editor behind it.',
  },
]

const MODE_STORAGE_KEY = 'meowdown:mode'
const MODE_QUERY_KEY = 'mode'

function isDemoMode(value: string | null): value is DemoMode {
  return MODES.some((option) => option.value === value)
}

// The URL query outranks sessionStorage, so a shared `?mode=` link pins the
// mode regardless of what the visitor picked before.
function readInitialMode(): DemoMode {
  const queryMode = new URLSearchParams(window.location.search).get(MODE_QUERY_KEY)
  if (queryMode != null) {
    if (isDemoMode(queryMode)) {
      return queryMode
    }
    console.warn(`[meowdown] Invalid mode in URL query: ${queryMode}`)
  }
  const storedMode = sessionStorage.getItem(MODE_STORAGE_KEY)
  return isDemoMode(storedMode) ? storedMode : 'focus'
}

function writeModeQuery(mode: DemoMode): void {
  const url = new URL(window.location.href)
  url.searchParams.set(MODE_QUERY_KEY, mode)
  history.replaceState(null, '', url)
}

export function useEditorMode() {
  const [mode, setModeState] = useState<DemoMode>(readInitialMode)

  const setMode = useCallback((nextMode: DemoMode) => {
    setModeState(nextMode)
    sessionStorage.setItem(MODE_STORAGE_KEY, nextMode)
    writeModeQuery(nextMode)
  }, [])

  const activeMode = MODES.find((option) => option.value === mode) ?? MODES[0]

  return { mode, setMode, activeMode }
}
