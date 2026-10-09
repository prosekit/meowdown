import type { PlainExtension } from '@prosekit/core'
import { defineEnterRule } from '@prosekit/extensions/enter-rule'
import { defineInputRule, type InputRuleHandler } from '@prosekit/extensions/input-rule'
import { InputRule } from '@prosekit/pm/inputrules'
import { createTextBlockEnterRule, type TextBlockEnterRuleOptions } from 'prosemirror-enter-rules'

import { isSingleParagraph } from './single-paragraph.ts'

/**
 * An input rule whose match turns the textblock into, or wraps it in, a block
 * node. In a single paragraph the match is left as typed text: there is no
 * block for it to open.
 */
export function defineBlockInputRule(regex: RegExp, handler: InputRuleHandler): PlainExtension {
  return defineInputRule(
    new InputRule(regex, (state, match, start, end) => {
      return isSingleParagraph(state) ? null : handler(state, match, start, end)
    }),
  )
}

/**
 * An enter rule whose match turns the textblock into a block node. In a single
 * paragraph the match is left as typed text, like {@link defineBlockInputRule}.
 */
export function defineBlockEnterRule(options: TextBlockEnterRuleOptions): PlainExtension {
  const rule = createTextBlockEnterRule(options)
  return defineEnterRule({
    ...rule,
    handler: (handlerOptions) => {
      return isSingleParagraph(handlerOptions.state) ? null : rule.handler(handlerOptions)
    },
  })
}
