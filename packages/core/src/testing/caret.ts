import { TextSelection } from '@prosekit/pm/state'
import { userEvent } from 'vitest/browser'

import { getSelectionSnapshot } from './selection-snapshot.ts'

import type { Fixture } from './index.ts'

/** Place a collapsed caret at text offset `offset`. */
export function setCaret(fixture: Fixture, offset: number): void {
  const { view } = fixture
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, offset + 1)))
  view.focus()
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
  const steps = [getSelectionSnapshot(fixture.state)]
  for (let index = 0; index < times; index++) {
    await userEvent.keyboard(`{${key}}`)
    steps.push(getSelectionSnapshot(fixture.state))
  }
  return steps
}

/**
 * On a fresh fixture from `setup`, place the caret at text offset `offset`,
 * press `key` once, and return the `before  ->  after` selection snapshot.
 */
export async function traceKeyAt(
  setup: () => Fixture,
  offset: number,
  key: string,
): Promise<string> {
  using fixture = setup()
  setCaret(fixture, offset)
  const before = getSelectionSnapshot(fixture.state)
  await userEvent.keyboard(`{${key}}`)
  return `${before}  ->  ${getSelectionSnapshot(fixture.state)}`
}
