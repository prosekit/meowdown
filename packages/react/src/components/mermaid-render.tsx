import type { RenderOptions } from 'beautiful-mermaid'
import { useLayoutEffect, useMemo, useRef, type MouseEventHandler, type ReactElement } from 'react'

import type { BeautifulMermaidRender } from '../hooks/use-beautiful-mermaid.ts'

interface MermaidRenderProps {
  renderer: BeautifulMermaidRender
  source: string
  className?: string
  'data-testid'?: string
  onMouseDown?: MouseEventHandler
}

const MERMAID_OPTIONS = {
  bg: 'var(--meowdown-mermaid-bg)',
  fg: 'var(--meowdown-mermaid-fg)',
  line: 'var(--meowdown-mermaid-line)',
  accent: 'var(--meowdown-mermaid-accent)',
  muted: 'var(--meowdown-mermaid-muted)',
  surface: 'var(--meowdown-mermaid-surface)',
  border: 'var(--meowdown-mermaid-border)',
  transparent: true,
  interactive: false,
} satisfies RenderOptions

type MermaidOutput =
  | { element: Element; error?: undefined }
  | { element?: undefined; error: string }

function renderMermaid(renderer: BeautifulMermaidRender, source: string): MermaidOutput {
  try {
    const svg = renderer(source, MERMAID_OPTIONS)
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const element = document.documentElement
    if (
      document.querySelector('parsererror') ||
      element.localName !== 'svg' ||
      element.namespaceURI !== 'http://www.w3.org/2000/svg'
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
  const output = useMemo(() => renderMermaid(renderer, source), [renderer, source])
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
      onMouseDown={onMouseDown}
    />
  )
}
