import type { DOMOutputSpec } from '@prosekit/pm/model'
import { createElement, Fragment, type ReactNode } from 'react'

// DOM attribute names whose React prop name differs. Covers the node/mark specs
// the walker renders (tables need colSpan/rowSpan; flat-list markers need the
// SVG names).
const ATTR_NAME_MAP: Record<string, string> = {
  class: 'className',
  contenteditable: 'contentEditable',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  viewbox: 'viewBox',
}

// The array form of `DOMOutputSpec`, typed precisely so element access does not
// degrade to `any` (ProseMirror types the tail as `any[]`).
type SpecChild = DOMOutputSpec | 0 | Record<string, string>
type SpecArray = readonly [string, ...SpecChild[]]

/**
 * Convert a `DOMOutputSpec` attribute object into React props, mapping the DOM
 * attribute names React spells differently. Exported for renderers that build
 * an element by hand (the static task checkbox) but source their attributes
 * from a node's real `toDOM` — see {@link outputSpecAttrs}.
 */
export function toReactProps(
  attrs: Record<string, string> | undefined,
  key?: number | string,
): Record<string, string | number> {
  const props: Record<string, string | number> = key === undefined ? {} : { key }
  if (!attrs) return props
  for (const [name, value] of Object.entries(attrs)) {
    // DOMOutputSpec `style` is a CSS string, which React rejects. Our specs do
    // not emit inline styles, so dropping it is safe.
    if (name === 'style') continue
    props[ATTR_NAME_MAP[name] ?? name] = value
  }
  return props
}

/** The attribute object of an array-form `DOMOutputSpec`, when it carries one. */
export function outputSpecAttrs(spec: DOMOutputSpec): Record<string, string> | undefined {
  if (typeof spec === 'string' || !Array.isArray(spec)) return undefined
  const second = (spec as SpecArray)[1]
  if (second != null && second !== 0 && typeof second === 'object' && !Array.isArray(second)) {
    return second as Record<string, string>
  }
  return undefined
}

/**
 * Convert a ProseMirror `DOMOutputSpec` into a React node, substituting `content`
 * for the spec's content hole (`0`). Reused for every node/mark spec the static
 * walker does not special-case, so blocks and plain marks render off their real
 * `toDOM`, exactly as the editor serializes them.
 */
export function outputSpecToReact(
  spec: DOMOutputSpec,
  content: ReactNode,
  key: number | string = 0,
): ReactNode {
  if (typeof spec === 'string') return spec
  if (!Array.isArray(spec)) return null

  const array = spec as SpecArray
  const tag = array[0]

  let childStart = 1
  let attrs: Record<string, string> | undefined
  const second = array[1]
  if (second != null && second !== 0 && typeof second === 'object' && !Array.isArray(second)) {
    attrs = second as Record<string, string>
    childStart = 2
  }

  const props = toReactProps(attrs, key)
  const rest = array.slice(childStart)
  if (rest.length === 0) return createElement(tag, props)

  const children = rest.map((child, index) =>
    child === 0 ? (
      <Fragment key={index}>{content}</Fragment>
    ) : (
      outputSpecToReact(child as DOMOutputSpec, content, index)
    ),
  )
  return createElement(tag, props, ...children)
}
