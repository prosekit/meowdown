import { playwright } from '@vitest/browser-playwright'
import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    retry: process.env.CI ? 3 : 0,
    bail: process.env.CI ? 0 : 1,
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
