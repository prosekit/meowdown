import { useEffect, useState } from 'react'

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

function readStoredMode(): DemoMode {
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

function writeStoredMode(mode: DemoMode): void {
  sessionStorage.setItem(MODE_STORAGE_KEY, mode)
}

export function useEditorMode() {
  const [mode, setMode] = useState<DemoMode>(readStoredMode)

  useEffect(() => {
    writeStoredMode(mode)
  }, [mode])

  const activeMode = MODES.find((option) => option.value === mode) ?? MODES[0]

  return { mode, setMode, activeMode }
}
