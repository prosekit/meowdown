import { getNodeType, type PlainExtension } from '@prosekit/core'
import {
  createTextBlockEnterRule,
  defineEnterRule,
  type TextBlockEnterRuleOptions,
} from '@prosekit/extensions/enter-rule'
import {
  defineInputRuleFactory,
  gateInputRule,
  type TextBlockInputRuleOptions,
  type WrappingInputRuleOptions,
} from '@prosekit/extensions/input-rule'
import { textblockTypeInputRule, wrappingInputRule, type InputRule } from '@prosekit/pm/inputrules'
import type { EditorState } from '@prosekit/pm/state'

import { getEditorConfig } from './editor-config-getter.ts'

function allowsBlocks(state: EditorState): boolean {
  return !getEditorConfig(state).singleParagraph
}

/**
 * Register an input rule that opens a block. It does nothing while
 * `singleParagraph` is set in the editor config.
 */
export function defineBlockInputRule(rule: InputRule): PlainExtension {
  return defineInputRuleFactory(() => gateInputRule(rule, allowsBlocks))
}

export function defineBlockTextBlockInputRule({
  regex,
  type,
  attrs,
}: TextBlockInputRuleOptions): PlainExtension {
  return defineInputRuleFactory(({ schema }) => {
    return gateInputRule(
      textblockTypeInputRule(regex, getNodeType(schema, type), attrs),
      allowsBlocks,
    )
  })
}

export function defineBlockWrappingInputRule({
  regex,
  type,
  attrs,
  join,
}: WrappingInputRuleOptions): PlainExtension {
  return defineInputRuleFactory(({ schema }) => {
    return gateInputRule(
      wrappingInputRule(regex, getNodeType(schema, type), attrs, join),
      allowsBlocks,
    )
  })
}

/**
 * Register an enter rule that opens a block. It does nothing while
 * `singleParagraph` is set in the editor config.
 */
export function defineBlockEnterRule(options: TextBlockEnterRuleOptions): PlainExtension {
  const rule = createTextBlockEnterRule(options)
  return defineEnterRule({
    ...rule,
    handler: (handlerOptions) => {
      return allowsBlocks(handlerOptions.state) ? rule.handler(handlerOptions) : null
    },
  })
}
