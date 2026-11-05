import { render, type RenderOptions } from 'pele'

import { sanitizeSvg } from '../utils/sanitize-svg.ts'

export function renderMermaid(source: string, options: RenderOptions): Element {
  const element = sanitizeSvg(render(source, options).svg)
  if (!element) throw new Error('Invalid SVG output.')
  return element
}

export type MermaidRenderer = typeof renderMermaid
