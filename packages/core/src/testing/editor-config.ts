import { replaceEditorConfig, type EditorConfig } from '../extensions/editor-config.ts'

// FIXME: remove this
export function updateEditorConfig(
  editor: Parameters<typeof replaceEditorConfig>[0],
  patch: EditorConfig,
  dispatch = false,
): void {
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
