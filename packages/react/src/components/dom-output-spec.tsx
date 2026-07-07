import type { DOMOutputSpec } from '@prosekit/pm/model'

// Better type safety than `DOMOutputSpec`
export type TypedDOMOutputSpec =
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
