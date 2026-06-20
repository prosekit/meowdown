import '@meowdown/core/style.css'
import '../style.css'

import './locator.ts'

import { server } from 'vitest/browser'

export function getBrowserName() {
  const name = server.browser
  if (name === 'webkit') {
    return 'webkit'
  } else if (name === 'chromium') {
    return 'chromium'
  } else if (name === 'firefox') {
    return 'firefox'
  } else {
    throw new Error(`Unsupported browser: ${name}`)
  }
}

export function isSafari() {
  return getBrowserName() === 'webkit'
}
