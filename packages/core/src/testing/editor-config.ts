import type { Editor } from '@prosekit/core'

import { replaceEditorConfig, type EditorConfig } from '../extensions/editor-config.ts'

export function updateEditorConfig(editor: Editor, patch: EditorConfig, dispatch = false): void {
  replaceEditorConfig(
    editor,
    (config) => {
      const keys = Object.keys(patch) as (keyof EditorConfig)[]
      return keys.every((key) => Object.is(config[key], patch[key]))
        ? config
        : { ...config, ...patch }
    },
    dispatch,
  )
}
