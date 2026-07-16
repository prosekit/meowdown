import { RuleTester } from '@typescript-eslint/rule-tester'
import { afterAll, describe, it } from 'vitest'

import { noTypeNameLiteral } from './no-type-name-literal.ts'

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

ruleTester.run('no-type-name-literal', noTypeNameLiteral, {
  valid: [
    'node.type.name === nodeName',
    'mark.type.name === markName',
    'node.type.name === myObject.myProperty',
    'mark.type.name === myObject.myProperty',
    'const name = node.type.name',
    'const name = mark.type.name',
    'node.type.name === `md${suffix}`',
    'switch (node.type.name as NodeName) { case "heading": break }',
    'switch (mark.type.name as MarkName) { case "mdImage": break }',
  ],
  invalid: [
    { code: "node.type.name === 'heading'", errors: [{ messageId: 'useHelper' }] },
    { code: "mark.type.name === 'mdImage'", errors: [{ messageId: 'useHelper' }] },
    { code: "node.type.name !== 'heading'", errors: [{ messageId: 'useHelper' }] },
    { code: "mark.type.name !== 'mdImage'", errors: [{ messageId: 'useHelper' }] },
    { code: "'heading' === node.type.name", errors: [{ messageId: 'useHelper' }] },
    { code: "'mdImage' === mark.type.name", errors: [{ messageId: 'useHelper' }] },
    {
      code: "node.type.name === ('list' satisfies NodeName)",
      errors: [{ messageId: 'useHelper' }],
    },
    {
      code: "mark.type.name === ('mdCode' satisfies MarkName)",
      errors: [{ messageId: 'useHelper' }],
    },
    { code: "paragraph?.type.name === 'paragraph'", errors: [{ messageId: 'useHelper' }] },
    { code: 'node.type.name === `heading`', errors: [{ messageId: 'useHelper' }] },
    { code: 'mark.type.name === `mdImage`', errors: [{ messageId: 'useHelper' }] },
    {
      code: "switch (node.type.name) { case 'heading': break }",
      errors: [{ messageId: 'castSwitchDiscriminant' }],
    },
    {
      code: "switch (mark.type.name) { case 'mdImage': break }",
      errors: [{ messageId: 'castSwitchDiscriminant' }],
    },
  ],
})
