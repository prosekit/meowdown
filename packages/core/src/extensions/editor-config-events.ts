import { definePlugin } from '@prosekit/core'
import { getSearchStatus } from '@prosekit/extensions/search'
import { Plugin } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { getEditorConfig, type EditorConfig } from './editor-config.ts'
import { equalInlineConfig } from './inline-text-to-mark-chunks.ts'

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

export function defineEditorConfigEvents() {
  return definePlugin(
    new Plugin({
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
