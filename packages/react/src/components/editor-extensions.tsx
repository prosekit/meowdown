import { replaceEditorConfig, type EditorConfig, type EditorExtension } from '@meowdown/core'
import { useEditor } from '@prosekit/react'
import { useDeferredValue, useEffect } from 'react'

interface EditorExtensionsProps {
  config: EditorConfig
  searchQuery: string
}

// A leaf that renders nothing and holds reactive configuration effects,
// so the parent editor keeps its lifecycle work in one place.
export function EditorExtensions({ config, searchQuery }: EditorExtensionsProps): null {
  const editor = useEditor<EditorExtension>()

  // Initial configuration already belongs to the creation extension. Later
  // updates run outside React's lifecycle because adapter views use flushSync.
  useEffect(() => {
    const timer = setTimeout(() => replaceEditorConfig(editor, config))
    return () => clearTimeout(timer)
  }, [editor, config])

  // Search has no latency requirement, so a slow device may skip the
  // intermediate values of a fast typist entirely. `literal` turns off
  // prosemirror-search's escape-sequence handling: a find bar takes text, so a
  // typed `\n` is a backslash and an `n`.
  const deferredSearchQuery = useDeferredValue(searchQuery)
  useEffect(() => {
    editor.commands.setSearchQuery({ search: deferredSearchQuery, literal: true })
  }, [editor, deferredSearchQuery])

  return null
}
