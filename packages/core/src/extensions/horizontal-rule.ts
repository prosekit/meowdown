import { defineNodeAttr, union, type Extension, type Union } from '@prosekit/core'
import {
  defineHorizontalRuleCommands,
  defineHorizontalRuleSpec,
  type HorizontalRuleCommandsExtension,
  type HorizontalRuleSpecExtension,
} from '@prosekit/extensions/horizontal-rule'

import type { NodeName } from './node-names.ts'

export interface MeowdownHorizontalRuleAttrs {
  /**
   * The literal markdown marker of a thematic break, e.g. `***`, `___`, or
   * `- - -`. Defaults to null, which the serializer emits as the canonical `---`.
   */
  marker?: string | null
}

type HorizontalRuleMarkerExtension = Extension<{
  Nodes: { horizontalRule: MeowdownHorizontalRuleAttrs }
}>

function defineHorizontalRuleMarkerAttr(): HorizontalRuleMarkerExtension {
  return defineNodeAttr<'horizontalRule', 'marker', string | null>({
    type: 'horizontalRule' satisfies NodeName,
    attr: 'marker',
    default: null,
    // Persist only a non-canonical marker; `---` is the serializer default
    // anyway. The marker rides on the wrapper `<div>` (which `parseDOM` now
    // matches) so an editor DOM re-parse keeps it.
    toDOM: (value) => (value ? ['data-hr-marker', value] : null),
    parseDOM: (node) => node.getAttribute('data-hr-marker'),
  })
}

export type MeowdownHorizontalRuleExtension = Union<
  [HorizontalRuleSpecExtension, HorizontalRuleCommandsExtension, HorizontalRuleMarkerExtension]
>

export function defineMeowdownHorizontalRule(): MeowdownHorizontalRuleExtension {
  return union(
    defineHorizontalRuleSpec(),
    defineHorizontalRuleCommands(),
    defineHorizontalRuleMarkerAttr(),
  )
}
