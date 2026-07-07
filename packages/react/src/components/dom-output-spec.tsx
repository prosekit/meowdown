import type { DOMOutputSpec } from '@prosekit/pm/model'
import { createElement, Fragment, type ReactNode } from 'react'
import { attributesToProps } from './attributes-to-props.ts'

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

// Better type safety than `DOMOutputSpec`
type TypedDOMOutputSpec =
  | HTMLElement
  | { dom: HTMLElement; contentDOM?: HTMLElement }
  | [string, Record<string, string>, ...TypedDOMOutputSpecChild[]]
  | [string, ...TypedDOMOutputSpecChild[]]

type TypedDOMOutputSpecChild = TypedDOMOutputSpec | 0 | string

export function normalizeDOMOutputSpec(
  domSpec: DOMOutputSpec,
):
  | [tag: string, attrs: Record<string, string> | undefined, rest: TypedDOMOutputSpecChild[]]
  | undefined {
  const spec = domSpec as TypedDOMOutputSpec
  if (!spec || !Array.isArray(spec)) return

  const tag = spec[0]

  let childStart = 1
  let attrs: Record<string, string> | undefined
  const second = spec[1]
  if (second != null && second !== 0 && typeof second === 'object' && !Array.isArray(second)) {
    attrs = second as Record<string, string>
    childStart = 2
  }

  const rest = spec.slice(childStart)
  return [tag, attrs, rest as TypedDOMOutputSpecChild[]]
}

/**
 * Convert a ProseMirror `DOMOutputSpec` into a React node, substituting `content`
 * for the spec's content hole (`0`). Reused for every node/mark spec the static
 * walker does not special-case, so blocks and plain marks render off their real
 * `toDOM`, exactly as the editor serializes them.
 */
export function outputSpecToReact(
  spec: DOMOutputSpec | 0 | string,
  content: ReactNode,
  key: number | string = 0,
): ReactNode {
  if (typeof spec === 'string') return spec
  if (spec === 0) return <Fragment key={key}>{content}</Fragment>

  const normalized = normalizeDOMOutputSpec(spec as TypedDOMOutputSpec)
  if (!normalized) return null

  const [tag, attrs, rest] = normalized
  const reactProps = attributesToProps(attrs, tag)
  const reactChildren = rest.map((child, index) => outputSpecToReact(child, content, index))
  return createElement(tag, { ...reactProps, key }, ...reactChildren)
}
