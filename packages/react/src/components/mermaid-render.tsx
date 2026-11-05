import type { RenderOptions } from 'pele'
import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type MouseEventHandler,
  type ReactElement,
} from 'react'

import type { MermaidRenderer } from '../hooks/use-pele.ts'

interface MermaidRenderProps {
  renderer: MermaidRenderer
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

type MermaidOutput =
  | { element: Element; error?: undefined }
  | { element?: undefined; error: string }

function getMermaidOutput(
  renderer: MermaidRenderer,
  source: string,
  idPrefix: string,
): MermaidOutput {
  try {
    return { element: renderer(source, { ...PELE_OPTIONS, idPrefix }) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export function MermaidRender(props: MermaidRenderProps): ReactElement {
  const { renderer, source, className, onMouseDown } = props
  const idPrefix = `meowdown-mermaid-${useId().replaceAll(/[^\w-]/g, '')}`
  const output = useMemo(
    () => getMermaidOutput(renderer, source, idPrefix),
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
