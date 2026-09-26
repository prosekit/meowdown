import { sleep } from '@ocavue/utils'
import { describe, expect, it, vi } from 'vitest'
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

  it('stays undefined and warns when the Promise rejects', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { promise, reject } = deferred<string>()
      const error = new Error('nope')
      await render(<Probe input={promise} />)
      reject(error)
      await sleep(20)
      await expect.element(value).toHaveTextContent('(pending)')
      expect(consoleWarn).toHaveBeenCalledWith('[meowdown] useMaybePromise input rejected:', error)
    } finally {
      consoleWarn.mockRestore()
    }
  })
})
