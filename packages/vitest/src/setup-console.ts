import { afterEach, beforeEach } from 'vitest'

const consoleMethods = ['assert', 'debug', 'dir', 'error', 'info', 'log', 'table', 'warn'] as const

type ConsoleMethod = (typeof consoleMethods)[number]

type ConsoleFunction = (...args: unknown[]) => void

const silencedMessages = [
  // A benign browser artifact: the skipped notifications are delivered on the
  // next frame. Base UI's popup auto-resize measurements trigger it in tight
  // viewports.
  'ResizeObserver loop completed with undelivered notifications',
]

const consoleObject = console as unknown as Record<ConsoleMethod, ConsoleFunction>

const originalMethods = {} as Record<ConsoleMethod, ConsoleFunction>

const unexpectedCalls: string[] = []

beforeEach(() => {
  unexpectedCalls.length = 0
  for (const method of consoleMethods) {
    originalMethods[method] = consoleObject[method]
    consoleObject[method] = (...args: unknown[]) => {
      if (method === 'assert') {
        // `console.assert` only prints when its first argument is falsy.
        if (args[0]) return
        args = ['Assertion failed:', ...args.slice(1)]
      }
      const message = args.map(String).join(' ')
      if (silencedMessages.some((silenced) => message.includes(silenced))) return
      unexpectedCalls.push(`console.${method}: ${message}`)
    }
  }
})

afterEach(() => {
  for (const method of consoleMethods) {
    consoleObject[method] = originalMethods[method]
  }
  if (unexpectedCalls.length === 0) return
  throw new Error(
    [
      'Expected the test not to write to the console.',
      "If the output is expected, mock the method out with `vi.spyOn(console, 'warn')` and assert on it.",
      ...unexpectedCalls,
    ].join('\n\n'),
  )
})
