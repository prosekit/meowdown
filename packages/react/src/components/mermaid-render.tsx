import type { RenderOptions } from 'pele'
import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type MouseEventHandler,
  type ReactElement,
} from 'react'

import type { PeleRender } from '../hooks/use-pele.ts'

interface MermaidRenderProps {
  renderer: PeleRender
  source: string
  className?: string
  'data-testid'?: string
  /**
   * Marks the host as a horizontal scroller.
   */
  'data-scroll-x'?: boolean
  onMouseDown?: MouseEventHandler
}

// Diagram source is untrusted. Never pass `icons`, `math` or `config`: Pele
// inserts icon and math markup unfiltered, and `config` must stay out of the
// author's reach. Links would navigate the host page, and images would make
// network requests when a note opens.
const PELE_OPTIONS = {
  links: false,
  images: false,
  responsive: false,
  autoDirection: false,
} as const satisfies RenderOptions

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const UNSAFE_ELEMENTS = new Set([
  'a',
  'animate',
  'animateMotion',
  'animateTransform',
  'foreignObject',
  'image',
  'script',
  'set',
])

type MermaidOutput =
  | { element: Element; error?: undefined }
  | { element?: undefined; error: string }

function isUnsafeElement(element: Element): boolean {
  if (element.namespaceURI !== SVG_NAMESPACE || UNSAFE_ELEMENTS.has(element.localName)) {
    return true
  }
  for (const attribute of element.attributes) {
    const name = attribute.localName.toLowerCase()
    if (name.startsWith('on')) return true
    if (name === 'href' && !attribute.value.startsWith('#')) return true
  }
  return false
}

function renderMermaid(renderer: PeleRender, source: string, idPrefix: string): MermaidOutput {
  try {
    const { svg } = renderer(source, { ...PELE_OPTIONS, idPrefix })
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const element = document.documentElement
    if (
      document.querySelector('parsererror') ||
      element.localName !== 'svg' ||
      isUnsafeElement(element) ||
      Array.from(element.querySelectorAll('*')).some(isUnsafeElement)
    ) {
      return { error: 'Invalid SVG output.' }
    }
    return { element }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export function MermaidRender(props: MermaidRenderProps): ReactElement {
  const { renderer, source, className, onMouseDown } = props
  const idPrefix = `meowdown-mermaid-${useId().replaceAll(/[^\w-]/g, '')}`
  const output = useMemo(
    () => renderMermaid(renderer, source, idPrefix),
    [renderer, source, idPrefix],
  )
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const host = ref.current
    if (!host || !output.element) return
    host.replaceChildren(window.document.importNode(output.element, true))
  }, [output])

  if (output.error) {
    return (
      <span
        key="error"
        className={className}
        contentEditable={false}
        data-error
        data-testid={props['data-testid']}
        data-scroll-x={props['data-scroll-x']}
        onMouseDown={onMouseDown}
      >
        {output.error}
      </span>
    )
  }

  return (
    <span
      key="svg"
      ref={ref}
      className={className}
      contentEditable={false}
      data-testid={props['data-testid']}
      data-scroll-x={props['data-scroll-x']}
      onMouseDown={onMouseDown}
    />
  )
}
