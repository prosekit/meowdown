import { defineConfig } from 'vitest/config'

// Screenshot tests run only in the autofix.ci workflow, which commits the
// updated reference screenshots back to the pull request.
export default defineConfig({
  test: {
    reporters: process.env.GITHUB_ACTIONS ? ['github-actions', 'verbose'] : ['default'],
    projects: ['./packages/*/vitest.visual.config.ts'],
  },
})
