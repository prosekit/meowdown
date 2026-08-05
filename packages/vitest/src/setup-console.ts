import { afterEach, beforeEach } from 'vitest'

type ConsoleMethod = 'error' | 'warn'

// A benign browser artifact: the skipped notifications are delivered on the
// next frame. Base UI's popup auto-resize measurements trigger it in tight
// viewports.
const silencedMessage = 'ResizeObserver loop completed with undelivered notifications'

const consoleMethods = ['error', 'warn'] as const

const originalMethods: Record<ConsoleMethod, (...args: unknown[]) => void> = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
}

const capturedMessages: Array<{ method: ConsoleMethod; message: string }> = []

beforeEach(() => {
  capturedMessages.length = 0
  for (const method of consoleMethods) {
    console[method] = (...args: unknown[]) => {
      const message = args.map(String).join(' ')
      if (message.includes(silencedMessage)) return
      capturedMessages.push({ method, message })
    }
  }
})

afterEach(() => {
  for (const method of consoleMethods) {
    console[method] = originalMethods[method]
  }
  if (capturedMessages.length === 0) return
  const detail = capturedMessages
    .map(({ method, message }) => `console.${method}: ${message}`)
    .join('\n')
  throw new Error(`[meowdown] unexpected console output:\n${detail}`)
})
