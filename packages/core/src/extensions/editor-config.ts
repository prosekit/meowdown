import { definePlugin, type Editor } from '@prosekit/core'
import type { PlaceholderOptions } from '@prosekit/extensions/placeholder'
import { getSearchStatus, type SearchStatusHandler } from '@prosekit/extensions/search'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@prosekit/pm/state'

import type { EditorView } from '@prosekit/pm/view'

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

const refreshKeys = [
  'markMode',
  'resolveFileLink',
  'resolveWikiEmbed',
  'resolveWikilink',
  'resolveImageUrl',
  'resolveFileInfo',
  'resolveXPost',
  'resolveYouTubeVideo',
  'placeholder',
  'readOnly',
  'spellCheck',
  'editorClassName',
] as const satisfies readonly (keyof EditorConfig)[]

function normalizeConfig(config: EditorConfig): Readonly<EditorConfig> {
  return Object.freeze({
    ...config,
    markMode: config.markMode ?? 'focus',
    embedPaste: config.embedPaste ?? false,
    linkPaste: config.linkPaste ?? false,
    bulletAfterHeading: config.bulletAfterHeading ?? false,
    substitution: config.substitution ?? false,
    wikilinkEnabled: config.wikilinkEnabled ?? false,
    readOnly: config.readOnly ?? false,
    placeholder: config.placeholder ?? '',
    editorClassName: config.editorClassName ?? '',
  })
}

const defaultConfig = normalizeConfig({})
type ConfigListener = (config: Readonly<EditorConfig>) => void
const viewListeners = new WeakMap<EditorView, Set<ConfigListener>>()

export function subscribeEditorConfig(view: EditorView, listener: ConfigListener): VoidFunction {
  let listeners = viewListeners.get(view)
  if (!listeners) {
    listeners = new Set()
    viewListeners.set(view, listeners)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function equalInlineConfig(left: InlineMarkOptions, right: InlineMarkOptions): boolean {
  return (
    left.resolveFileLink === right.resolveFileLink &&
    left.resolveWikiEmbed === right.resolveWikiEmbed &&
    left.resolveWikilink === right.resolveWikilink
  )
}

class ConfigController {
  config: Readonly<EditorConfig>

  constructor(initialConfig: EditorConfig) {
    this.config = normalizeConfig(initialConfig)
  }
}

const configKey = new PluginKey<ConfigController>('meowdown-config')

/** Read the current configuration. Callback values are live, not historical state snapshots. */
export function getEditorConfig(state: EditorState): Readonly<EditorConfig> {
  return configKey.getState(state)?.config ?? defaultConfig
}

function getEditorConfigUpdate(transaction: Transaction): Readonly<EditorConfig> | undefined {
  return transaction.getMeta(configKey) as Readonly<EditorConfig> | undefined
}

/**
 * Replace the complete configuration. Omitted fields return to their defaults.
 * Equal values do no work; callbacks and event-time flags do not dispatch.
 */
export function replaceEditorConfig(editor: Editor, config: EditorConfig): void {
  const controller = configKey.getState(editor.state)
  if (!controller) throw new Error('[meowdown] editor configuration is missing')
  const next = normalizeConfig(config)
  const previous = controller.config
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)] as (keyof EditorConfig)[])
  if ([...keys].every((key) => Object.is(previous[key], next[key]))) return

  if (refreshKeys.some((key) => !Object.is(previous[key], next[key]))) {
    const transaction = editor.state.tr.setMeta(configKey, next).setMeta('addToHistory', false)
    if (previous.markMode !== next.markMode)
      transaction.setMeta('meowdown-config-mark-mode', next.markMode)
    if (editor.mounted) editor.view.dispatch(transaction)
    else editor.updateState(editor.state.apply(transaction))
  } else {
    controller.config = next
  }
}

export function defineEditorConfig(initialConfig: EditorConfig) {
  return definePlugin(
    new Plugin<ConfigController>({
      key: configKey,
      state: {
        init: () => new ConfigController(initialConfig),
        apply: (transaction, controller) => {
          const config = getEditorConfigUpdate(transaction)
          if (config) controller.config = config
          return controller
        },
      },
      props: {
        editable: (state) => !getEditorConfig(state).readOnly,
        attributes: (state) => {
          const { editorClassName, spellCheck } = getEditorConfig(state)
          const attributes: Record<string, string> = {}
          if (editorClassName) attributes.class = editorClassName
          if (spellCheck != null) attributes.spellcheck = String(spellCheck)
          return attributes
        },
      },
      view: (view) => {
        let previousConfig = getEditorConfig(view.state)
        return {
          update: (currentView, previousState) => {
            const config = getEditorConfig(currentView.state)
            const parserChanged = !equalInlineConfig(previousConfig, config)
            const configChanged = config !== previousConfig
            previousConfig = config
            if (configChanged) {
              for (const listener of viewListeners.get(currentView) ?? []) listener(config)
            }
            if (
              !currentView.state.doc.eq(previousState.doc) &&
              !(
                parserChanged && currentView.state.doc.textContent === previousState.doc.textContent
              )
            ) {
              config.onDocChange?.()
            }
            if (config.onSearchChange) {
              const status = getSearchStatus(currentView.state)
              const previous = getSearchStatus(previousState)
              if (status.total !== previous.total || status.active !== previous.active) {
                config.onSearchChange(status)
              }
            }
          },
        }
      },
    }),
  )
}
