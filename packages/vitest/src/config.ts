import { playwright } from '@vitest/browser-playwright'
import { playwrightCommands } from 'vitest-browser-commands'
import { defineProject } from 'vitest/config'

const IS_BOT = !!(process.env.AI_AGENT || process.env.CI)
const IS_DEBUG = !!process.env.DEBUG

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

  const setupFiles = ['@meowdown/vitest/setup-console']
  if (browserName === 'webkit') {
    setupFiles.push('@meowdown/vitest/setup-webkit')
  }

  return defineProject({
    plugins: [playwrightCommands()],
    oxc:
      browserName === 'webkit'
        ? // WebKit's JavaScriptCore can't parse `using` declarations; lower them
          { target: 'es2025' }
        : undefined,
    test: {
      setupFiles,
      retry: IS_BOT ? 3 : 0,
      fileParallelism: false,
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
        headless: IS_DEBUG ? false : true,
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
