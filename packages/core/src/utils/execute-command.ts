import type { Command } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

export function executeCommand(view: EditorView, command: Command): boolean {
  return command(view.state, view.dispatch, view)
}
