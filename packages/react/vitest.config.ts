import { playwright } from '@vitest/browser-playwright'
import { playwrightCommands } from 'vitest-browser-commands'
import { defineProject } from 'vitest/config'

export default defineProject({
  plugins: [playwrightCommands()],
  // Pre-bundle so the first lazy import in a test does not trigger a mid-run reload.
  optimizeDeps: {
    include: ['@prosekit/core/test'],
  },
  test: {
    browser: {
      enabled: true,
      viewport: {
        width: 900,
        height: 600,
      },
      provider: playwright({
        launchOptions: {},
        contextOptions: {
          reducedMotion: 'reduce',
          hasTouch: true,
          permissions: ['clipboard-read', 'clipboard-write'],
        },
      }),
      headless: true,
      ui: false,
      instances: [
        {
          browser: 'chromium',
        },
      ],
    },
  },
})
