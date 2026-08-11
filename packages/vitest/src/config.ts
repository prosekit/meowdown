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
        locators: {
          // Vitest 5 matches text exactly by default; keep the v4 substring
          // matching so `getByText` calls keep finding partial text.
          exact: false,
        },
        provider: playwright({
          launchOptions: {
            // Opt into the new Chrome headless mode by using "chromium" channel. Along
            // with `playwright install chromium --no-shell`, we no longer need to
            // download two copies of Chromium anymore.
            // See https://playwright.dev/docs/browsers#chromium-new-headless-mode
            channel: browserName === 'chromium' ? 'chromium' : undefined,
          },
          contextOptions: {
            reducedMotion: 'reduce',
            hasTouch: true,
            // A list of permissions to grant to all pages in this context.
            // See https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions
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
