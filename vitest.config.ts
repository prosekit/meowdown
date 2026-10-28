import { defineConfig } from 'vitest/config'

const coverageEnabled = !!process.env.MEOWDOWN_TEST_COVERAGE

const isVisual = !!process.env.MEOWDOWN_TEST_VISUAL

const reporters = process.env.GITHUB_ACTIONS ? ['github-actions', 'verbose'] : ['default']

export default defineConfig({
  test: {
    reporters: isVisual
      ? // A self-contained page with the reference, actual, and diff screenshots.
        [...reporters, ['html', { outputDir: '.vitest/report', singleFile: true }]]
      : reporters,
    retry: process.env.CI ? 3 : 0,
    coverage: {
      enabled: coverageEnabled,
      reporter: ['text-summary', 'text', 'html', 'json', 'json-summary'],
      include: ['packages/*/src/**'],
    },
    slowTestThreshold: 10_000,
    projects: isVisual
      ? ['./packages/*/vitest.visual.config.ts']
      : ['./packages/*/vitest.node.config.ts', './packages/*/vitest.browser.config.ts'],
  },
})
