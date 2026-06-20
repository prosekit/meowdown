import { defineConfig } from 'vitest/config'

const coverageEnabled = !!process.env.MEOWDOWN_TEST_COVERAGE

export default defineConfig({
  test: {
    reporters: process.env.GITHUB_ACTIONS ? ['github-actions', 'verbose'] : ['default'],
    retry: process.env.CI ? 3 : 0,
    bail: process.env.CI ? 0 : 1,
    coverage: {
      enabled: coverageEnabled,
      reporter: ['text-summary', 'text', 'html', 'json', 'json-summary'],
      include: ['packages/*/src/**'],
    },
    projects: ['./packages/*'],
  },
})
