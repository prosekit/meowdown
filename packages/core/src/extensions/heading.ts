import {
  defineKeymap,
  defineNodeAttr,
  defineNodeSpec,
  isAtBlockStart,
  toggleNode,
  union,
  unsetBlockType,
  withSkipCodeBlock,
  type Extension,
  type PlainExtension,
} from '@prosekit/core'
import {
  defineHeadingCommands,
  defineHeadingInputRule,
  defineHeadingSpec,
  type HeadingAttrs,
} from '@prosekit/extensions/heading'
import type { Command } from '@prosekit/pm/state'

import type { NodeName } from './node-names.ts'

export interface MeowdownHeadingAttrs extends HeadingAttrs {
  /**
   * For a setext heading, the number of underline characters (`=` for level 1,
   * `-` for level 2) that followed the text in the source. CommonMark allows
   * any underline length, so keeping the count makes the round-trip lossless.
   * `null` (the default) marks an ATX heading (`# foo`); only levels 1 and 2
   * can be setext, and the level alone decides the underline character.
   */
  setextUnderline?: number | null
}

type HeadingSpecExtension = Extension<{
  Nodes: { heading: HeadingAttrs }
}>

/**
 * Merge `whitespace: 'pre'` onto the base heading spec. A multi-line setext
 * heading keeps a soft line break as a literal `\n`; without `whitespace: 'pre'`
 * (and `white-space: pre-wrap` in the stylesheet) a DOM re-read folds it to a
 * space, dropping the break. `defineNodeSpec` merges specs of the same name, so
 * this adds the single field without re-declaring the heading spec.
 */
function defineHeadingWhitespace(): HeadingSpecExtension {
  return defineNodeSpec({ name: 'heading' satisfies NodeName, whitespace: 'pre' })
}

type SetextUnderlineExtension = Extension<{
  Nodes: { heading: { setextUnderline?: number | null } }
}>

function defineSetextUnderlineAttr(): SetextUnderlineExtension {
  return defineNodeAttr<'heading', 'setextUnderline', number | null>({
    type: 'heading' satisfies NodeName,
    attr: 'setextUnderline',
    default: null,
    // A heading split or created in the editor is ATX; only a parsed setext
    // heading carries a length, which must survive an editor DOM re-parse.
    toDOM: (value) => (value != null ? ['data-setext-underline', String(value)] : null),
    parseDOM: (node) => {
      const raw = node.getAttribute('data-setext-underline')
      if (raw == null) return null
      const length = Number.parseInt(raw, 10)
      return Number.isSafeInteger(length) && length > 0 ? length : null
    },
  })
}

function toggleHeading(level: number): Command {
  return withSkipCodeBlock(toggleNode({ type: 'heading' satisfies NodeName, attrs: { level } }))
}

const backspaceUnsetHeading: Command = (state, dispatch, view) => {
  const $pos = isAtBlockStart(state, view)
  if ($pos?.parent.type.name === ('heading' satisfies NodeName)) {
    return unsetBlockType()(state, dispatch, view)
  }
  return false
}

function defineHeadingKeymap(): PlainExtension {
  return defineKeymap({
    'Mod-1': toggleHeading(1),
    'Mod-2': toggleHeading(2),
    'Mod-3': toggleHeading(3),
    'Mod-4': toggleHeading(4),
    'Mod-5': toggleHeading(5),
    'Mod-6': toggleHeading(6),
    Backspace: backspaceUnsetHeading,
  })
}

export function defineHeading() {
  return union(
    defineHeadingSpec(),
    defineHeadingWhitespace(),
    defineSetextUnderlineAttr(),
    defineHeadingInputRule(),
    defineHeadingCommands(),
    defineHeadingKeymap(),
  )
}
