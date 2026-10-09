import type { PlainExtension } from '@prosekit/core'
import { defineEnterRule } from '@prosekit/extensions/enter-rule'
import { createTextBlockEnterRule, type TextBlockEnterRuleOptions } from 'prosemirror-enter-rules'

import { getEditorConfig } from './editor-config-getter.ts'

/**
 * Register an enter rule that opens a block. It does nothing while
 * `singleParagraph` is set in the editor config.
 */
export function defineBlockEnterRule(options: TextBlockEnterRuleOptions): PlainExtension {
  const rule = createTextBlockEnterRule(options)
  return defineEnterRule({
    ...rule,
    handler: (handlerOptions) => {
      return getEditorConfig(handlerOptions.state).singleParagraph
        ? null
        : rule.handler(handlerOptions)
    },
  })
}
