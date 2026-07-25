import { definePlugin, type PlainExtension } from '@prosekit/core'
import { type EditorState, Plugin } from '@prosekit/pm/state'

/**
 * Add DOM attributes to the editable root. `class` and `style` values from
 * every such extension are combined, so applying this more than once adds
 * classes instead of replacing them.
 */
export function defineViewAttributes(
  attributes: { [name: string]: string } | ((state: EditorState) => { [name: string]: string }),
): PlainExtension {
  return definePlugin(new Plugin({ props: { attributes } }))
}
