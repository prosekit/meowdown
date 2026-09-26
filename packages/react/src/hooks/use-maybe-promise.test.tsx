import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import { useMaybePromise } from './use-maybe-promise.ts'

function Probe({ input }: { input: string | Promise<string> }) {
  const value = useMaybePromise(input)
  return <output data-testid="value">{value ?? '(pending)'}</output>
}

const value = page.getByTestId('value')

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useMaybePromise', () => {
  it('returns a plain value as-is', async () => {
    await render(<Probe input="sync" />)
    await expect.element(value).toHaveTextContent('sync')
  })

  it('is undefined until a Promise resolves, then holds its value', async () => {
    const { promise, resolve } = deferred<string>()
    await render(<Probe input={promise} />)
    await expect.element(value).toHaveTextContent('(pending)')
    resolve('later')
    await expect.element(value).toHaveTextContent('later')
  })

  it('drops the previous result as soon as the input changes', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const screen = await render(<Probe input={first.promise} />)
    first.resolve('first')
    await expect.element(value).toHaveTextContent('first')

    await screen.rerender(<Probe input={second.promise} />)
    await expect.element(value).toHaveTextContent('(pending)')
    // The older Promise settling late must not overwrite the newer input.
    second.resolve('second')
    await expect.element(value).toHaveTextContent('second')
  })

  it('ignores a Promise that resolves after the input was replaced', async () => {
    const stale = deferred<string>()
    const screen = await render(<Probe input={stale.promise} />)
    await screen.rerender(<Probe input="sync" />)
    stale.resolve('stale')
    await expect.element(value).toHaveTextContent('sync')
    await new Promise((done) => setTimeout(done, 20))
    await expect.element(value).toHaveTextContent('sync')
  })

  it('stays undefined when the Promise rejects', async () => {
    const { promise, reject } = deferred<string>()
    await render(<Probe input={promise} />)
    reject(new Error('nope'))
    await new Promise((done) => setTimeout(done, 20))
    await expect.element(value).toHaveTextContent('(pending)')
  })
})
