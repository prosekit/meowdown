import { definePlugin, type Editor } from '@prosekit/core'
import type { PlaceholderOptions } from '@prosekit/extensions/placeholder'
import type { SearchStatusHandler } from '@prosekit/extensions/search'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'

import type { ExitBoundaryHandler } from './exit-boundary.ts'
import type { FilePasteOptions } from './file-paste.ts'
import type { FileViewOptions } from './file-view.ts'
import type { FollowLinkHandlers } from './follow-link.ts'
import type { ImageOptions } from './image.ts'
import type { InlineMarkOptions } from './inline-text-to-mark-chunks.ts'
import type { MarkMode } from './mark-mode.ts'

export interface EditorConfig
  extends InlineMarkOptions, FollowLinkHandlers, FilePasteOptions, FileViewOptions, ImageOptions {
  markMode?: MarkMode
  onDocChange?: VoidFunction
  onExitBoundary?: ExitBoundaryHandler
  onSearchChange?: SearchStatusHandler
  embedPaste?: boolean
  linkPaste?: boolean
  bulletAfterHeading?: boolean
  substitution?: boolean
  wikilinkEnabled?: boolean
  placeholder?: PlaceholderOptions['placeholder']
  readOnly?: boolean
  spellCheck?: boolean
  editorClassName?: string
}

const defaultConfig: Readonly<EditorConfig> = Object.freeze({})

class ConfigController {
  config: Readonly<EditorConfig>

  constructor(config: Readonly<EditorConfig>) {
    this.config = config
  }
}

const configKey = new PluginKey<ConfigController>('meowdown-config')

/**
 * Read the current configuration. Callback values are live, not historical state snapshots.
 */
export function getEditorConfig(state: EditorState): Readonly<EditorConfig> {
  return configKey.getState(state)?.config ?? defaultConfig
}

/**
 * Return the original configuration to skip an update. Dispatch explicitly
 * when a change must refresh the editor view or state-dependent plugins.
 */
export function replaceEditorConfig(
  // FIXME: remove replaceEditorConfig. use the updateEditorConfig below to replace it.
  editor: Pick<Editor, 'state' | 'view' | 'mounted' | 'updateState'>,
  updater: (config: Readonly<EditorConfig>) => Readonly<EditorConfig>,
  dispatch = false,
): void {
  const controller = configKey.getState(editor.state)
  if (!controller) return
  const next = updater(controller.config)
  if (next === controller.config) return
  controller.config = next
  if (!dispatch) return
  const tr = editor.state.tr
    .setMeta('addToHistory', false)
    .setMeta('meowdown_editor_config_update', true)
  if (editor.mounted) editor.view.dispatch(tr)
  else editor.updateState(editor.state.apply(tr))
}

const refreshKeys = new Set<keyof EditorConfig>([
  'markMode',
  'resolveFileLink',
  'resolveWikiEmbed',
  'resolveWikilink',
  'placeholder',
  'readOnly',
  'spellCheck',
  'editorClassName',
] as const)

function updateEditorConfig(
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
