import {
  defineNodeAttr,
  getNodeType,
  union,
  type Extension,
  type PlainExtension,
  type Union,
} from '@prosekit/core'
import {
  defineHorizontalRuleCommands,
  defineHorizontalRuleSpec,
  type HorizontalRuleCommandsExtension,
  type HorizontalRuleSpecExtension,
} from '@prosekit/extensions/horizontal-rule'
import { defineInputRule } from '@prosekit/extensions/input-rule'
import { InputRule } from '@prosekit/pm/inputrules'

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

// ProseKit's bundled input rule inserts the rule without checking whether the
// parent accepts it, so typing `---` in an inline-only container (a table cell)
// throws. This guarded rule mirrors ProseKit's but bails when the parent forbids
// a horizontal rule, matching how `textblockTypeInputRule` guards headings.
function defineGuardedHorizontalRuleInputRule(): PlainExtension {
  return defineInputRule(
    new InputRule(/^---$/, (state, _match, start, end) => {
      const type = getNodeType(state.schema, 'horizontalRule' satisfies NodeName)
      const $start = state.doc.resolve(start)
      const index = $start.index(-1)
      if (!$start.node(-1).canReplaceWith(index, index, type)) {
        return null
      }
      return state.tr
        .delete(start, end)
        .insert(start - 1, type.createChecked())
        .scrollIntoView()
    }),
  )
}

export type MeowdownHorizontalRuleExtension = Union<
  [HorizontalRuleSpecExtension, HorizontalRuleCommandsExtension, HorizontalRuleMarkerExtension]
>

export function defineMeowdownHorizontalRule(): MeowdownHorizontalRuleExtension {
  return union(
    defineHorizontalRuleSpec(),
    defineHorizontalRuleCommands(),
    defineGuardedHorizontalRuleInputRule(),
    defineHorizontalRuleMarkerAttr(),
  )
}
