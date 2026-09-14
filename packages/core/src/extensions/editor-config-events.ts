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
              // FIXME: do not call onDocChange maunlly. Just keep using the defineDocChangeHandler as we did before in master. Notice that we DO NOT need to move all config to the editorConfig
              config.onDocChange?.()
            }
            // FIXME: do not call onSearchChange maunlly. Just keep using the defineSearchStatusHandler as we did before in master. Notice that we DO NOT need to move all config to the editorConfig
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
