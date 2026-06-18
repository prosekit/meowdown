import type { EditorMode } from '@meowdown/react'
import { useEffect, useState } from 'react'

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
  {
    value: 'source',
    label: 'Source',
    description: 'Raw Markdown with syntax highlighting, like an IDE.',
  },
]

const MODE_STORAGE_KEY = 'meowdown:mode'

function readStoredMode(): EditorMode {
  const stored = sessionStorage.getItem(MODE_STORAGE_KEY)
  if (stored) {
    for (const option of MODES) {
      if (option.value === stored) {
        return option.value
      }
    }
  }
  return 'focus'
}

function writeStoredMode(mode: EditorMode): void {
  sessionStorage.setItem(MODE_STORAGE_KEY, mode)
}

export function useEditorMode() {
  const [mode, setMode] = useState<EditorMode>(readStoredMode)

  useEffect(() => {
    writeStoredMode(mode)
  }, [mode])

  const activeMode = MODES.find((option) => option.value === mode) ?? MODES[0]

  return { mode, setMode, activeMode }
}
