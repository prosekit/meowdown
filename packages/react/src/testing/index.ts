import '@meowdown/core/style.css'
import '../style.css'

import './locator.ts'

import { beforeEach } from 'vitest'
import { cleanup } from 'vitest-browser-react'

beforeEach(async () => {
  // vitest-browser-react 2.x registers this cleanup in its module body, but the
  // module-scope `beforeEach` breaks on vitest 5's browser runner (the runner
  // is not set yet when the module is evaluated). Register it here instead.
  await cleanup()
})
