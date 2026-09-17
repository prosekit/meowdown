import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import type { TSESLint, TSESTree } from '@typescript-eslint/utils'

function isSetTimeoutCallee(callee: TSESTree.Expression): boolean {
  if (callee.type === AST_NODE_TYPES.Identifier) return callee.name === 'setTimeout'
  return (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    !callee.computed &&
    callee.object.type === AST_NODE_TYPES.Identifier &&
    (callee.object.name === 'window' || callee.object.name === 'globalThis') &&
    callee.property.type === AST_NODE_TYPES.Identifier &&
    callee.property.name === 'setTimeout'
  )
}

function getResolveName(executor: TSESTree.Node): string | undefined {
  if (
    executor.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
    executor.type !== AST_NODE_TYPES.FunctionExpression
  ) {
    return undefined
  }
  const [param] = executor.params
  if (param?.type !== AST_NODE_TYPES.Identifier) return undefined
  return param.name
}

function getExecutorBodyCall(executor: TSESTree.Node): TSESTree.CallExpression | undefined {
  if (
    executor.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
    executor.type !== AST_NODE_TYPES.FunctionExpression
  ) {
    return undefined
  }
  const { body } = executor
  if (body.type === AST_NODE_TYPES.CallExpression) return body
  if (body.type !== AST_NODE_TYPES.BlockStatement || body.body.length !== 1) return undefined
  const [statement] = body.body
  if (statement?.type !== AST_NODE_TYPES.ExpressionStatement) return undefined
  return statement.expression.type === AST_NODE_TYPES.CallExpression
    ? statement.expression
    : undefined
}

function isResolveOnlyCallback(callback: TSESTree.Node, resolveName: string): boolean {
  if (callback.type === AST_NODE_TYPES.Identifier) return callback.name === resolveName
  const call = getExecutorBodyCall(callback)
  return (
    call != null &&
    call.arguments.length === 0 &&
    call.callee.type === AST_NODE_TYPES.Identifier &&
    call.callee.name === resolveName
  )
}

export const preferSleep: TSESLint.RuleModule<'preferSleep'> = {
  defaultOptions: [],
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow `new Promise((resolve) => setTimeout(resolve, ms))`; use `sleep(ms)` from `@ocavue/utils`.',
    },
    messages: {
      preferSleep:
        'Use `sleep(ms)` from `@ocavue/utils` instead of `new Promise((resolve) => setTimeout(resolve, ms))`.',
    },
    schema: [],
  },
  create(context) {
    return {
      NewExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier || node.callee.name !== 'Promise') return
        const [executor] = node.arguments
        if (executor == null) return
        const resolveName = getResolveName(executor)
        if (resolveName == null) return
        const call = getExecutorBodyCall(executor)
        if (call == null || !isSetTimeoutCallee(call.callee)) return
        const [callback] = call.arguments
        if (callback == null || !isResolveOnlyCallback(callback, resolveName)) return
        context.report({ node, messageId: 'preferSleep' })
      },
    }
  },
}
