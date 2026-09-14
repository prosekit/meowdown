import { definePlugin } from '@prosekit/core'
import { getSearchStatus } from '@prosekit/extensions/search'
import { Plugin, type EditorState } from '@prosekit/pm/state'

import type { EditorConfig } from './editor-config.ts'
import { equalInlineConfig } from './inline-text-to-mark-chunks.ts'

export function defineEditorConfigEvents(
  getConfig: (state: EditorState) => Readonly<EditorConfig>,
) {
  return definePlugin(
    new Plugin({
      view: (view) => {
        let previousConfig = getConfig(view.state)
        return {
          update: (currentView, previousState) => {
            const config = getConfig(currentView.state)
            const parserChanged = !equalInlineConfig(previousConfig, config)
            previousConfig = config
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
