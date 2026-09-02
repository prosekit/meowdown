import { afterEach, beforeEach } from 'vitest'

/**
 * Every `console` method that prints something. `clear`, `countReset`,
 * `groupEnd`, `time` and `timeStamp` are left alone because they never print a
 * message.
 */
const consoleMethods = [
  'assert',
  'count',
  'debug',
  'dir',
  'dirxml',
  'error',
  'group',
  'groupCollapsed',
  'info',
  'log',
  'table',
  'timeEnd',
  'timeLog',
  'trace',
  'warn',
] as const

type ConsoleMethod = (typeof consoleMethods)[number]

type ConsoleFunction = (...args: unknown[]) => void

// A benign browser artifact: the skipped notifications are delivered on the
// next frame. Base UI's popup auto-resize measurements trigger it in tight
// viewports.
const silencedMessages = ['ResizeObserver loop completed with undelivered notifications']

const consoleObject = console as unknown as Record<ConsoleMethod, ConsoleFunction>

const originalMethods = {} as Record<ConsoleMethod, ConsoleFunction>

const unexpectedCalls: string[] = []

function formatArguments(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg
      if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`
      return String(arg)
    })
    .join(' ')
}

beforeEach(() => {
  unexpectedCalls.length = 0
  for (const method of consoleMethods) {
    originalMethods[method] = consoleObject[method]
    consoleObject[method] = (...args: unknown[]) => {
      // `console.assert` only prints when its first argument is falsy.
      if (method === 'assert') {
        if (args[0]) return
        args = ['Assertion failed:', ...args.slice(1)]
      }
      const message = formatArguments(args)
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
