import { definePlugin } from '@prosekit/core'
import { type EditorState, Plugin, PluginKey } from '@prosekit/pm/state'

export function defineViewAttributes(
  attributes: { [name: string]: string } | ((state: EditorState) => { [name: string]: string }),
) {
  return definePlugin(
    new Plugin({
      key: new PluginKey('meowdown-view-attributes'),
      props: { attributes },
    }),
  )
}
