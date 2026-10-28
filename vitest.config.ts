import { defineConfig } from 'vitest/config'

const coverageEnabled = !!process.env.MEOWDOWN_TEST_COVERAGE

const isVisual = !!process.env.MEOWDOWN_TEST_VISUAL

export default defineConfig({
  test: {
    reporters: process.env.GITHUB_ACTIONS ? ['github-actions', 'verbose'] : ['default'],
    retry: process.env.CI ? 3 : 0,
    coverage: {
      enabled: coverageEnabled,
      reporter: ['text-summary', 'text', 'html', 'json', 'json-summary'],
      include: ['packages/*/src/**'],
    },
    slowTestThreshold: 10_000,
    // FIXME: delete vitest.visual.config.ts, just use the isVisual flag to determine which config to use
    projects: isVisual
      ? ['./packages/*/vitest.visual.config.ts']
      : ['./packages/*/vitest.node.config.ts', './packages/*/vitest.browser.config.ts'],
  },
})
