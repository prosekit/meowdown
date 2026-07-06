import type { render } from 'katex'

export type KaTeXRender = typeof render

let katexRenderPromise: Promise<KaTeXRender> | undefined

/**
 * Load KaTeX's render function on first use and cache it. Most documents
 * contain no math, so the library stays out of the initial bundle.
 */
export function loadKaTeX(): Promise<KaTeXRender> {
  katexRenderPromise ??= import('katex').then((module) => module.render)
  return katexRenderPromise
}

/**
 * Render TeX into `element` as native MathML (no KaTeX stylesheet or fonts
 * required). `throwOnError: false` renders parse errors as red text; the
 * catch covers the rare non-parse error so a bad formula can never crash a
 * render.
 */
export function renderMathInto(
  katexRender: KaTeXRender,
  element: HTMLElement,
  formula: string,
  displayMode: boolean,
): void {
  try {
    katexRender(formula, element, { displayMode, throwOnError: false, output: 'mathml' })
  } catch (error) {
    element.textContent = String(error)
  }
}
