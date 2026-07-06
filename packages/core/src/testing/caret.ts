import { userEvent } from 'vitest/browser'

import { getSelectionSnapshot } from './selection-snapshot.ts'

import type { Fixture } from './index.ts'

/**
 * Press `key` `times` times, capturing the selection snapshot before the first
 * press and after each one. The returned array has `times + 1` entries.
 */
export async function traceKeySelection(
  fixture: Fixture,
  key: string,
  times: number,
): Promise<string[]> {
  const steps = new Set([getSelectionSnapshot(fixture.state)])
  const extraTimes = 2 // We press the key more times than requested to address flaky tests.
  for (let index = 0; index < times + extraTimes; index++) {
    await userEvent.keyboard(`{${key}}`)
    steps.add(getSelectionSnapshot(fixture.state))
    if (steps.size > times) {
      break
    }
  }
  return Array.from(steps)
}

/**
 * On a fresh fixture from `setup(text)`, with the caret at the `<a>` tag in
 * `text`, press `key` once, and return the `before  ->  after` selection
 * snapshot.
 */
export async function traceKeyAt(
  setup: (text: string) => Fixture,
  text: string,
  key: string,
): Promise<string> {
  using fixture = setup(text)
  const before = getSelectionSnapshot(fixture.state)
  await userEvent.keyboard(`{${key}}`)
  return `${before}  ->  ${getSelectionSnapshot(fixture.state)}`
}
