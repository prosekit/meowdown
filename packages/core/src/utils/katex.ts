import type katex from 'katex'

export type KaTeX = typeof katex

let katexPromise: Promise<KaTeX> | undefined

/**
 * Load KaTeX on first use and cache the module. Most documents contain no
 * math, so the library stays out of the initial bundle.
 */
export function loadKaTeX(): Promise<KaTeX> {
  katexPromise ??= import('katex').then((module) => module.default)
  return katexPromise
}
