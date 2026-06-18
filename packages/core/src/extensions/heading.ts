import {
  defineKeymap,
  isAtBlockStart,
  toggleNode,
  union,
  unsetBlockType,
  withSkipCodeBlock,
  type PlainExtension,
} from '@prosekit/core'
import {
  defineHeadingCommands,
  defineHeadingInputRule,
  defineHeadingSpec,
} from '@prosekit/extensions/heading'
import type { Command } from '@prosekit/pm/state'

import type { NodeName } from './node-names.ts'

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
    defineHeadingInputRule(),
    defineHeadingCommands(),
    defineHeadingKeymap(),
  )
}
