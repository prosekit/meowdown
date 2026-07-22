import { playwright } from '@vitest/browser-playwright'
import { playwrightCommands } from 'vitest-browser-commands'
import { defineProject } from 'vitest/config'

const IS_BOT = !!(process.env.AI_AGENT || process.env.CI)
const IS_DEBUG = !!process.env.DEBUG

export function defineSharedConfig({
  groupOrder,
  env,
}: {
  groupOrder: number
  env: 'browser' | 'node'
}) {
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
  if (env === 'browser' && browserName === 'webkit') {
    setupFiles.push('@meowdown/vitest/setup-webkit')
  }

  return defineProject({
    plugins: [playwrightCommands()],
    oxc:
      env === 'browser' && browserName === 'webkit'
        ? // WebKit's JavaScriptCore can't parse `using` declarations; lower them
          { target: 'es2025' }
        : undefined,
    test: {
      setupFiles,
      snapshotSerializers: ['@meowdown/vitest/custom-string-serializer'],
      sequence: {
        groupOrder,
      },
      retry: IS_BOT ? 3 : 0,
      fileParallelism: false,
      browser: {
        enabled: env === 'browser',
        viewport: {
          width: 900,
          height: 600,
        },
        provider: playwright({
          launchOptions: {},
          contextOptions: {
            reducedMotion: 'reduce',
            hasTouch: true,
            // Chromium rejects `navigator.clipboard.writeText` without this
            // grant, even inside a real click. Tests read the clipboard back
            // through a native paste (`@meowdown/vitest/clipboard`), so no
            // browser needs a read grant. See https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions
            permissions: browserName === 'chromium' ? ['clipboard-write'] : undefined,
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
