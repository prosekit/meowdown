import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, type EditorState } from '@prosekit/pm/state'

export function defineReadonly(
  getReadonly: (state: EditorState) => boolean = () => true,
): PlainExtension {
  return definePlugin(new Plugin({ props: { editable: (state) => !getReadonly(state) } }))
}
