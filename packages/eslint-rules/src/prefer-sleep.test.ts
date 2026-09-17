import { RuleTester } from '@typescript-eslint/rule-tester'
import { afterAll, describe, it } from 'vitest'

import { preferSleep } from './prefer-sleep.ts'

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

ruleTester.run('prefer-sleep', preferSleep, {
  valid: [
    'await sleep(200)',
    'setTimeout(callback, 200)',
    'new Promise((resolve) => setTimeout(() => resolve(value), 200))',
    'new Promise((resolve) => setTimeout(() => { flush(); resolve() }, 200))',
    'new Promise((resolve) => setInterval(resolve, 200))',
    'new Promise((resolve) => { timer = setTimeout(resolve, 200) })',
    'new Promise((resolve) => requestAnimationFrame(resolve))',
  ],
  invalid: [
    {
      code: 'await new Promise((resolve) => setTimeout(resolve, 200))',
      errors: [{ messageId: 'preferSleep' }],
    },
    {
      code: 'new Promise((resolve) => setTimeout(resolve, 200))',
      errors: [{ messageId: 'preferSleep' }],
    },
    {
      code: 'new Promise((resolve) => setTimeout(resolve))',
      errors: [{ messageId: 'preferSleep' }],
    },
    {
      code: 'new Promise((done) => setTimeout(done, delay))',
      errors: [{ messageId: 'preferSleep' }],
    },
    {
      code: 'new Promise((resolve, reject) => setTimeout(resolve, 200))',
      errors: [{ messageId: 'preferSleep' }],
    },
    {
      code: 'new Promise((resolve) => { setTimeout(resolve, 200) })',
      errors: [{ messageId: 'preferSleep' }],
    },
    {
      code: 'new Promise((resolve) => setTimeout(() => resolve(), 200))',
      errors: [{ messageId: 'preferSleep' }],
    },
    {
      code: 'new Promise((resolve) => window.setTimeout(resolve, 200))',
      errors: [{ messageId: 'preferSleep' }],
    },
    {
      code: 'new Promise((resolve) => globalThis.setTimeout(resolve, 200))',
      errors: [{ messageId: 'preferSleep' }],
    },
    {
      code: 'new Promise<void>(function (resolve) { setTimeout(resolve, 200) })',
      errors: [{ messageId: 'preferSleep' }],
    },
  ],
})
