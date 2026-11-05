import { render } from 'pele'
import { describe, expect, it } from 'vitest'

import { sanitizeSvg } from './sanitize-svg.ts'

function describeTree(element: Element): string[] {
  return [element, ...element.querySelectorAll('*')].map((node) => {
    const attributes = Array.from(node.attributes, (attribute) => {
      return `${attribute.name}=${attribute.value}`
    })
    return [node.localName, ...attributes.toSorted()].join(' ')
  })
}

function sanitizeOrThrow(svg: string): Element {
  const element = sanitizeSvg(svg)
  if (!element) throw new Error('Expected an <svg> element.')
  return element
}

describe('sanitizeSvg', () => {
  it('keeps Pele output unchanged', () => {
    const sources = [
      'flowchart LR\n  subgraph S\n  A[Start] --> B{Ok?}\n  end\n  B -->|yes| C((End))\n  style A fill:#f00',
      'sankey-beta\nIncome,Rent,1200\nIncome,Food,500',
      'gantt\n  dateFormat YYYY-MM-DD\n  section Design\n    Research :a1, 2026-11-01, 5d',
    ]
    for (const source of sources) {
      const { svg } = render(source, { links: false, images: false, idPrefix: 'test' })
      const original = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
      expect(describeTree(sanitizeOrThrow(svg))).toEqual(describeTree(original))
    }
  })

  it('removes event handlers and keeps the shapes', () => {
    const element = sanitizeOrThrow(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect onclick="alert(1)" width="1"/></svg>',
    )

    expect(describeTree(element)).toEqual(['svg xmlns=http://www.w3.org/2000/svg', 'rect width=1'])
  })

  it('removes script URLs, foreign objects, scripts, and animations', () => {
    const element = sanitizeOrThrow(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<a href="javascript:alert(1)"><text>Link</text></a>' +
        '<use href="https://example.com/a.svg#b"/>' +
        '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">HTML</div></foreignObject>' +
        '<script>alert(1)</script>' +
        '<set attributeName="href" to="javascript:alert(1)"/>' +
        '<text>Safe</text>' +
        '</svg>',
    )

    expect(element.querySelector('[href], use, foreignObject, script, set')).toBeNull()
    expect(element.textContent).toBe('LinkSafe')
  })

  it('returns undefined without an <svg> root', () => {
    expect(sanitizeSvg('<div>Text</div>')).toBeUndefined()
    expect(sanitizeSvg('<script>alert(1)</script>')).toBeUndefined()
  })
})
