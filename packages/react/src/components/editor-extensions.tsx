import {
  getEditorConfig,
  replaceEditorConfig,
  type EditorConfig,
  type EditorExtension,
} from '@meowdown/core'
import { useEditor } from '@prosekit/react'
import { useDeferredValue, useEffect } from 'react'

const refreshKeys = [
  'markMode',
  'resolveFileLink',
  'resolveWikiEmbed',
  'resolveWikilink',
  'resolveImageUrl',
  'resolveXPost',
  'resolveYouTubeVideo',
  'placeholder',
  'readOnly',
  'spellCheck',
  'editorClassName',
] as const satisfies readonly (keyof EditorConfig)[]

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
    const timer = setTimeout(() => {
      const previous = getEditorConfig(editor.state)
      const dispatch = refreshKeys.some((key) => !Object.is(previous[key], config[key]))
      replaceEditorConfig(
        editor,
        (current) => {
          const keys = new Set([
            ...Object.keys(current),
            ...Object.keys(config),
          ] as (keyof EditorConfig)[])
          return [...keys].every((key) => Object.is(current[key], config[key])) ? current : config
        },
        dispatch,
      )
    })
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
