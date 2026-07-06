import type katex from 'katex'

export type KaTeX = typeof katex

let katexPromise: Promise<KaTeX> | undefined

/**
 * Load KaTeX on first use and cache the module. Most documents contain no
 * math, so the library stays out of the initial bundle.
 */
export function loadKaTeX(): Promise<KaTeX> {
  // REVIEW：to reduce bundle size, we could import only the functions we need instead of the whole module. We can use named import to import only the "render" function from the "katex" module.
  katexPromise ??= import('katex').then((module) => module.default)
  return katexPromise
}

/**
 * Render TeX into `element` as native MathML (no KaTeX stylesheet or fonts
 * required). `throwOnError: false` renders parse errors as red text; the
 * catch covers the rare non-parse error so a bad formula can never crash a
 * render.
 */
export function renderMathInto(
  katex: KaTeX,
  element: HTMLElement,
  formula: string,
  displayMode: boolean,
): void {
  try {
    katex.render(formula, element, { displayMode, throwOnError: false, output: 'mathml' })
  } catch (error) {
    element.textContent = String(error)
  }
}
