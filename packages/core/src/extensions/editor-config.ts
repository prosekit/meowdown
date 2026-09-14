import { definePlugin, type Editor } from '@prosekit/core'
import { Plugin } from '@prosekit/pm/state'

import { configKey } from './editor-config-getter.ts'
import type { EditorConfig } from './editor-config-types.ts'

class ConfigController {
  config: Readonly<EditorConfig>

  constructor(config: Readonly<EditorConfig>) {
    this.config = config
  }
}

const refreshKeys = new Set<keyof EditorConfig>([
  'markMode',
  'placeholder',
  'readOnly',
  'spellCheck',
  'editorClassName',
] as const)

export function updateEditorConfig(
  editor: Pick<Editor, 'state' | 'view' | 'mounted' | 'updateState'>,
  patch: Partial<EditorConfig>,
): void {
  const controller = configKey.getState(editor.state)
  if (!controller) return

  const oldConfig = controller.config

  let updated = false
  let refresh = false

  const keys = Object.keys(patch) as (keyof EditorConfig)[]
  for (const key of keys) {
    if (patch[key] !== oldConfig[key]) {
      updated = true
      if (refreshKeys.has(key)) {
        refresh = true
      }
    }
  }

  if (updated) controller.config = { ...oldConfig, ...patch }
  if (!refresh) return
  const tr = editor.state.tr.setMeta('addToHistory', false).setMeta(refreshKey, true)
  if (editor.mounted) editor.view.dispatch(tr)
  else editor.updateState(editor.state.apply(tr))
}

const refreshKey = 'meowdown_editor_config_refresh'

export function defineEditorConfig(initialConfig: EditorConfig) {
  return definePlugin(
    new Plugin<ConfigController>({
      key: configKey,
      state: {
        init: (): ConfigController => {
          return new ConfigController(initialConfig)
        },
        apply: (tr, controller): ConfigController => {
          // Create a new editor state if refresh is needed.
          if (tr.getMeta(refreshKey)) {
            return new ConfigController(controller.config)
          }
          return controller
        },
      },
    }),
  )
}
