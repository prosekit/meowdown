import { meowdownConfig } from '@meowdown/eslint-rules'
import { defineESLintConfig } from '@ocavue/eslint-config'

export default defineESLintConfig(
  {
    react: {
      version: '19.2',
      reactCompiler: true,
      files: ['**/*.tsx'],
    },
    markdown: false,
    command: true,
    jsdoc: true,
  },
  {
    ignores: ['**/*.module.d.css.ts', '**/*.astro'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.test.*', '**/*.spec.*'],
    rules: {
      complexity: ['error', { max: 20, variant: 'modified' }],
      'max-nested-callbacks': ['error', { max: 3 }],
      'max-depth': ['error', { max: 5 }],
      'max-statements': ['error', { max: 40 }],
    },
  },
  meowdownConfig,
)
