import { playwright } from '@vitest/browser-playwright'
import { playwrightCommands } from 'vitest-browser-commands'
import { defineProject } from 'vitest/config'

const IS_BOT = !!(process.env.AI_AGENT || process.env.CI)
const IS_DEBUG = !!process.env.DEBUG

function resolveBrowserName() {
  const name = process.env.MEOWDOWN_TEST_BROWSER
  if (!name) {
    return 'chromium'
  } else if (name === 'webkit' || name === 'firefox' || name === 'chromium') {
    return name
  } else {
    throw new Error(`Unsupported browser: ${name}`)
  }
}

/**
 * A project for tests that don't need a browser. It only picks up `*.test.ts`.
 */
export function defineNodeConfig({ name, groupOrder }: { name: string; groupOrder: number }) {
  return defineProject({
    test: {
      name,
      include: ['src/**/*.test.ts'],
      environment: 'node',
      setupFiles: ['@meowdown/vitest/setup-console'],
      snapshotSerializers: ['@meowdown/vitest/custom-string-serializer'],
      sequence: { groupOrder },
      retry: 0,
    },
  })
}

/**
 * A project for tests that need a real browser. It only picks up `*.test.tsx`.
 */
export function defineBrowserConfig({ name, groupOrder }: { name: string; groupOrder: number }) {
  const browserName = resolveBrowserName()

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
      name,
      include: ['src/**/*.test.tsx'],
      setupFiles,
      snapshotSerializers: ['@meowdown/vitest/custom-string-serializer'],
      sequence: { groupOrder },
      retry: process.env.PROBE_RETRY ? Number(process.env.PROBE_RETRY) : IS_BOT ? 3 : 0,
      fileParallelism: false,
      browser: {
        enabled: true,
        viewport: {
          width: 900,
          height: 600,
        },
        provider: playwright({
          launchOptions: {
            // Opt into the new Chrome headless mode by using "chromium" channel. Along
            // with `playwright install chromium --no-shell`, we no longer need to
            // download two copies of Chromium anymore.
            // See https://playwright.dev/docs/browsers#chromium-new-headless-mode
            channel:
              browserName === 'chromium' && process.env.PROBE_CHROMIUM_CHANNEL !== 'none'
                ? 'chromium'
                : undefined,
            executablePath: process.env.PROBE_CHROMIUM_PATH || undefined,
            args: process.env.PROBE_CHROMIUM_ARGS
              ? process.env.PROBE_CHROMIUM_ARGS.split(' ')
              : undefined,
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
