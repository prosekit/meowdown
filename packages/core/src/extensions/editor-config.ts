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

  constructor(initialConfig: EditorConfig) {
    this.config = { ...initialConfig }
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

export function defineEditorConfig(initialConfig: EditorConfig) {
  return definePlugin(
    new Plugin<ConfigController>({
      key: configKey,
      state: {
        init: () => new ConfigController(initialConfig),
        apply: (_transaction, controller) => controller,
      },
    }),
  )
}
