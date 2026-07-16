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
  },
  {
    ignores: ['**/*.module.d.css.ts'],
  },
  meowdownConfig,
)
