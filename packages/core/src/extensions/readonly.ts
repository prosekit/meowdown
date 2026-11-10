import { returnTrue } from '@ocavue/utils'
import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, type EditorState } from '@prosekit/pm/state'

export function defineReadonly(
  getReadonly: (state: EditorState) => boolean = returnTrue,
): PlainExtension {
  return definePlugin(new Plugin({ props: { editable: (state) => !getReadonly(state) } }))
}
