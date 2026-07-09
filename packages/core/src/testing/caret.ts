import { userEvent } from 'vitest/browser'

import { getSelectionSnapshot } from './selection-snapshot.ts'

import type { Fixture } from './index.ts'

async function traceSelection(
  fixture: Fixture,
  press: () => Promise<void>,
  times: number,
): Promise<string[]> {
  const steps = new Set([getSelectionSnapshot(fixture.state)])
  const extraTimes = 2 // We press the key more times than requested to address flaky tests.
  for (let index = 0; index < times + extraTimes; index++) {
    await press()
    steps.add(getSelectionSnapshot(fixture.state))
    if (steps.size > times) {
      break
    }
  }
  return Array.from(steps)
}

/**
 * Press `key` `times` times, capturing the selection snapshot before the first
 * press and after each one. The returned array has `times + 1` entries.
 */
export async function traceKeySelection(
  fixture: Fixture,
  key: string,
  times: number,
): Promise<string[]> {
  return await traceSelection(fixture, () => userEvent.keyboard(`{${key}}`), times)
}

/**
 * Like {@link traceKeySelection}, but holds Shift through each press.
 */
export async function traceShiftKeySelection(
  fixture: Fixture,
  key: string,
  times: number,
): Promise<string[]> {
  return await traceSelection(fixture, () => userEvent.keyboard(`{Shift>}{${key}}{/Shift}`), times)
}

/**
 * Render trace steps as one readable snapshot: each document state on its own
 * lines, separated by a dashed rule.
 */
export function formatSelectionSteps(steps: string[]): string {
  return steps.map((step) => '\n' + step + '\n').join('-'.repeat(10))
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
