import { PluginKey, type EditorState } from '@prosekit/pm/state'

import type { EditorConfig } from './editor-config-types.ts'

const defaultConfig: Readonly<EditorConfig> = Object.freeze({})

export const configKey = new PluginKey<{ config: Readonly<EditorConfig> }>('meowdown-editor-config')

/**
 * Read the current configuration. Callback values are live, not historical state snapshots.
 */
export function getEditorConfig(state: EditorState): Readonly<EditorConfig> {
  return configKey.getState(state)?.config ?? defaultConfig
}
