import './stories.css'

import { MeowdownEditor, type EditorMode } from '@meowdown/react'

import defaultPreset from '../presets/default.md?raw'
import { useMounted } from './use-mounted.ts'

export interface SingleEditorProps {
  mode?: EditorMode
  readOnly?: boolean
  spellCheck?: boolean
  blockHandle?: boolean
  placeholder?: string
  initialMarkdown?: string
}

export function SingleEditor({ initialMarkdown = defaultPreset, ...props }: SingleEditorProps) {
  const mounted = useMounted()
  if (!mounted) return null
  return (
    <div className="story-frame">
      <MeowdownEditor initialMarkdown={initialMarkdown} {...props} />
    </div>
  )
}
