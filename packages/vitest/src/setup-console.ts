import { afterEach, beforeEach, vi } from 'vitest'

const silencedMessages = [
  // A benign browser artifact: the skipped notifications are delivered on the
  // next frame. Base UI's popup auto-resize measurements trigger it in tight
  // viewports.
  'ResizeObserver loop completed with undelivered notifications',
]

const unexpectedCalls: string[] = []

function logImplementation(...args: unknown[]) {
  const message = args.map(String).join(' ')
  for (const pattern of silencedMessages) {
    if (message.includes(pattern)) return
  }
  unexpectedCalls.push(message)
}

function assertImplementation(condition: unknown, ...args: unknown[]) {
  if (condition) return
  logImplementation(...args)
}

function spy() {
  const warn = vi.spyOn(console, 'warn').mockImplementation(logImplementation)
  const error = vi.spyOn(console, 'error').mockImplementation(logImplementation)
  const log = vi.spyOn(console, 'log').mockImplementation(logImplementation)
  const info = vi.spyOn(console, 'info').mockImplementation(logImplementation)
  const assert = vi.spyOn(console, 'assert').mockImplementation(assertImplementation)

  return () => {
    warn.mockRestore()
    error.mockRestore()
    log.mockRestore()
    info.mockRestore()
    assert.mockRestore()
  }
}

let restoreSpy: VoidFunction | undefined

beforeEach(() => {
  unexpectedCalls.length = 0
  restoreSpy = spy()
})

afterEach(() => {
  restoreSpy?.()
  restoreSpy = undefined

  if (unexpectedCalls.length === 0) return
  throw new Error(
    [
      'Expected the test not to write to the console.',
      "If the output is expected, mock the method out with `vi.spyOn(console, 'warn')` and assert on it.",
      ...unexpectedCalls,
    ].join('\n\n'),
  )
})
