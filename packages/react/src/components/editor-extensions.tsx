import { defineMarkMode, type MarkMode } from '@meowdown/core'
import { defineDocChangeHandler } from '@prosekit/core'
import { useExtension } from '@prosekit/react'
import { useMemo } from 'react'

export interface EditorExtensionsProps {
  markMode: MarkMode
  onDocChange?: VoidFunction
}

// A leaf that renders nothing and holds every reactive `useExtension` call (each
// runs effect hooks), so the parent editor re-renders less. `useExtension` reads
// the editor from context.
export function EditorExtensions({ markMode, onDocChange }: EditorExtensionsProps): null {
  useExtension(useMemo(() => defineMarkMode(markMode), [markMode]))

  useExtension(
    useMemo(() => (onDocChange ? defineDocChangeHandler(onDocChange) : null), [onDocChange]),
  )

  return null
}
