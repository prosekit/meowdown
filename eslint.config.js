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
    ignores: ['**/*.module.d.css.ts', 'website/src/presets/**/*.md'],
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
  {
    files: ['**/*.tsx'],
    rules: {
      // https://react.dev/reference/eslint-plugin-react-hooks/lints/refs
      'react-hooks/refs': 'error',
      // https://github.com/facebook/react/blob/d083ec1da1e5252abd3ddfdde6dfbc09701a2c51/compiler/packages/babel-plugin-react-compiler/src/CompilerError.ts#L981-L988
      'react-hooks/todo': 'error',
    },
  },
  meowdownConfig,
)
