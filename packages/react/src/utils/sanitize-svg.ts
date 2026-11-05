import DOMPurify from 'dompurify'

/**
 * Parses an SVG string and removes anything that can run script. Returns
 * `undefined` when no single `<svg>` root remains.
 */
export function sanitizeSvg(svg: string): Element | undefined {
  const fragment = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_ATTR: ['role'],
    RETURN_DOM_FRAGMENT: true,
  })
  const element = fragment.firstElementChild
  if (fragment.childElementCount !== 1 || element?.localName !== 'svg') return
  return element
}
