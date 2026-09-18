import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'eslint-rules-node',
    include: ['src/**/*.test.ts'],
    environment: 'node',
    sequence: { groupOrder: 200 },
  },
})
