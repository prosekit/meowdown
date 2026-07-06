import type { KaTeX } from '@meowdown/core'

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
