import { union } from '@prosekit/core'
import {
  blockquoteInputRule,
  defineBlockquoteCommands,
  defineBlockquoteKeymap,
  defineBlockquoteSpec,
} from '@prosekit/extensions/blockquote'
import { createWrappingInputRuleHandler } from '@prosekit/extensions/input-rule'

import { defineBlockInputRule } from './block-rule.ts'

export function defineMeowdownBlockquote() {
  return union(
    defineBlockquoteSpec(),
    defineBlockquoteCommands(),
    defineBlockquoteKeymap(),
    defineBlockInputRule(
      blockquoteInputRule.regex,
      createWrappingInputRuleHandler(blockquoteInputRule),
    ),
  )
}
