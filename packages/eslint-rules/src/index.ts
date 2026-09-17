import type { TSESLint } from '@typescript-eslint/utils'

import { noTypeNameLiteral } from './no-type-name-literal.ts'
import { preferSleep } from './prefer-sleep.ts'

export const meowdownConfig: TSESLint.FlatConfig.Config = {
  files: ['**/*.ts', '**/*.tsx'],
  plugins: {
    meowdown: {
      meta: { name: '@meowdown/eslint-rules' },
      rules: {
        'no-type-name-literal': noTypeNameLiteral,
        'prefer-sleep': preferSleep,
      },
    },
  },
  rules: {
    'meowdown/no-type-name-literal': 'error',
    'meowdown/prefer-sleep': 'error',
  },
}
