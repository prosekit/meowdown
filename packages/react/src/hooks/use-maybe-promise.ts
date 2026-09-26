import { useEffect, useState } from 'react'

/**
 * The settled value of `input`: `input` itself when it is not a `Promise`,
 * otherwise `undefined` until it resolves. A rejection stays `undefined` and is
 * reported with `console.warn`, since the caller has no other way to see it. A
 * new `input` discards the previous `Promise`'s result at once, so a stale
 * value never shows for a newer input. Callers memoize `input`, or a fresh
 * `Promise` on every render never settles.
 */
export function useMaybePromise<T>(input: T | Promise<T>): T | undefined {
  const [settled, setSettled] = useState<{ input: Promise<T>; value: T } | null>(null)
  useEffect(() => {
    if (!(input instanceof Promise)) return
    let active = true
    input.then(
      (value) => {
        if (active) setSettled({ input, value })
      },
      (error: unknown) => {
        if (active) console.warn('[meowdown] useMaybePromise input rejected:', error)
      },
    )
    return () => {
      active = false
    }
  }, [input])
  if (!(input instanceof Promise)) return input
  return settled?.input === input ? settled.value : undefined
}
