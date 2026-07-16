import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import type { TSESLint, TSESTree } from '@typescript-eslint/utils'

const COMPARISON_OPERATORS = new Set(['==', '!=', '===', '!=='])

function unwrapChain(node: TSESTree.Node): TSESTree.Node {
  return node.type === AST_NODE_TYPES.ChainExpression ? node.expression : node
}

function isTypeNameAccess(candidate: TSESTree.Node): boolean {
  const expression = unwrapChain(candidate)
  return (
    expression.type === AST_NODE_TYPES.MemberExpression &&
    !expression.computed &&
    expression.property.type === AST_NODE_TYPES.Identifier &&
    expression.property.name === 'name' &&
    expression.object.type === AST_NODE_TYPES.MemberExpression &&
    !expression.object.computed &&
    expression.object.property.type === AST_NODE_TYPES.Identifier &&
    expression.object.property.name === 'type'
  )
}

function isStringConstant(candidate: TSESTree.Node): boolean {
  if (
    candidate.type === AST_NODE_TYPES.TSSatisfiesExpression ||
    candidate.type === AST_NODE_TYPES.TSAsExpression
  ) {
    return isStringConstant(candidate.expression)
  }
  if (candidate.type === AST_NODE_TYPES.Literal) return typeof candidate.value === 'string'
  return candidate.type === AST_NODE_TYPES.TemplateLiteral && candidate.expressions.length === 0
}

type MessageId = 'useHelper' | 'castSwitchDiscriminant'

export const noTypeNameLiteral: TSESLint.RuleModule<MessageId> = {
  defaultOptions: [],
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow comparing `.type.name` to a string; use `isNodeOfType` / `isMarkOfType` from `@meowdown/core`.',
    },
    messages: {
      useHelper:
        'Use `isNodeOfType(node, name)` / `isMarkOfType(mark, name)` from `@meowdown/core` instead of comparing `.type.name` to a string.',
      castSwitchDiscriminant:
        'Cast the discriminant (`node.type.name as NodeName` / `mark.type.name as MarkName`) so TypeScript checks every `case` clause against the union.',
    },
    schema: [],
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (!COMPARISON_OPERATORS.has(node.operator)) return
        if (
          (isTypeNameAccess(node.left) && isStringConstant(node.right)) ||
          (isTypeNameAccess(node.right) && isStringConstant(node.left))
        ) {
          context.report({ node, messageId: 'useHelper' })
        }
      },
      SwitchStatement(node) {
        if (isTypeNameAccess(node.discriminant)) {
          context.report({ node: node.discriminant, messageId: 'castSwitchDiscriminant' })
        }
      },
    }
  },
}
