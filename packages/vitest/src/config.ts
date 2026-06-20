import { playwright } from '@vitest/browser-playwright'
import { playwrightCommands } from 'vitest-browser-commands'
import { defineProject } from 'vitest/config'

export function defineSharedConfig() {
  const browserName = (() => {
    if (process.env.MEOWDOWN_TEST_BROWSER === 'webkit') {
      return 'webkit'
    } else if (process.env.MEOWDOWN_TEST_BROWSER === 'firefox') {
      return 'firefox'
    } else if (process.env.MEOWDOWN_TEST_BROWSER === 'chromium') {
      return 'chromium'
    } else if (process.env.MEOWDOWN_TEST_BROWSER) {
      throw new Error(`Unsupported browser: ${process.env.MEOWDOWN_TEST_BROWSER}`)
    }
    return 'chromium'
  })()

  return defineProject({
    plugins: [playwrightCommands()],
    oxc:
      browserName === 'webkit'
        ? // WebKit's JavaScriptCore can't parse `using` declarations; lower them
          { target: 'es2025' }
        : undefined,
    test: {
      setupFiles: browserName === 'webkit' ? ['@meowdown/vitest/setup-webkit'] : [],
      retry: process.env.CI ? 3 : 0,
      bail: process.env.CI ? 0 : 1,
      fileParallelism:false,
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
            // A list of permissions to grant to all pages in this context. See https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions
            permissions:
              browserName === 'chromium' ? ['clipboard-read', 'clipboard-write'] : undefined,
          },
        }),
        headless: true,
        ui: false,
        instances: [
          {
            browser: browserName,
          },
        ],
      },
    },
  })
}
