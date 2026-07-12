import failOnConsole from 'vitest-fail-on-console'

failOnConsole({
  shouldFailOnWarn: true,
  shouldFailOnError: true,
  // A benign browser artifact: the skipped notifications are delivered on the
  // next frame. Base UI's popup auto-resize measurements trigger it in tight
  // viewports.
  silenceMessage: (message) =>
    message.includes('ResizeObserver loop completed with undelivered notifications'),
})
