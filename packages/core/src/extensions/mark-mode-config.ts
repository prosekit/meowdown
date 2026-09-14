import type { EditorState } from '@prosekit/pm/state'

import { getEditorConfig } from './editor-config-getter.ts'
import type { MarkMode } from './mark-mode.ts'

/**
 * The active mark mode, defaulting to focus when no configuration is provided.
 */
export function getMarkMode(state: EditorState): MarkMode {
  return getEditorConfig(state).markMode ?? 'focus'
}
