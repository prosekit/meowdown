import { useLayoutEffect, useRef, type MouseEventHandler, type ReactElement } from 'react'

import { sanitizeHTMLBlock } from '../utils/sanitize-html.ts'

interface HTMLBlockRenderProps {
  /** The raw HTML block source. Sanitized before it reaches the DOM. */
  source: string
  className?: string
  'data-testid'?: string
  onMouseDown?: MouseEventHandler
}

/**
 * Whether a raw HTML block would render anything visible. An element block that
 * sanitizes to nothing (e.g. a lone `<iframe>`) keeps showing its source
 * instead of collapsing into an empty, unclickable preview.
 */
export function htmlBlockHasVisiblePreview(source: string): boolean {
  const fragment = sanitizeHTMLBlock(source)
  return fragment.childElementCount > 0 || (fragment.textContent?.trim().length ?? 0) > 0
}

/**
 * The sanitized preview of a raw HTML block, injected into a real element (not
 * `dangerouslySetInnerHTML`). Shared by the editor node view and the read-only
 * `MarkdownView`, so both surfaces render HTML the same way.
 */
export function HTMLBlockRender(props: HTMLBlockRenderProps): ReactElement {
  const { source, className, onMouseDown } = props
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    element.replaceChildren(sanitizeHTMLBlock(source))
  }, [source])
  return (
    <div
      ref={ref}
      className={className}
      contentEditable={false}
      data-testid={props['data-testid']}
      onMouseDown={onMouseDown}
    />
  )
}
