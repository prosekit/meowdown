import { union } from '@prosekit/core'
import {
  blockquoteInputRule,
  defineBlockquoteCommands,
  defineBlockquoteKeymap,
  defineBlockquoteSpec,
} from '@prosekit/extensions/blockquote'

import { defineBlockWrappingInputRule } from './block-rule.ts'

export function defineMeowdownBlockquote() {
  return union(
    defineBlockquoteSpec(),
    defineBlockquoteCommands(),
    defineBlockquoteKeymap(),
    defineBlockWrappingInputRule(blockquoteInputRule),
  )
}
