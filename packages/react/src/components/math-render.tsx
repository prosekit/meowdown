import { renderMathInto, type KaTeX } from '@meowdown/core'
import { useLayoutEffect, useRef, type MouseEventHandler, type ReactElement } from 'react'

interface MathRenderProps {
  /** The KaTeX module, or `undefined` while it loads (renders empty). */
  katex: KaTeX | undefined
  formula: string
  displayMode: boolean
  className?: string
  'data-testid'?: string
  onMouseDown?: MouseEventHandler
}

/**
 * KaTeX output rendered into a real element, the same way the editor's
 * `MathMarkView` does. A span host matches KaTeX's own output shape; display
 * mode emits a block-level `math[display="block"]` element.
 */
export function MathRender(props: MathRenderProps): ReactElement {
  const { katex, formula, displayMode, className, onMouseDown } = props
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !katex) return
    renderMathInto(katex, element, formula, displayMode)
  }, [katex, formula, displayMode])
  return (
    <span
      ref={ref}
      className={className}
      contentEditable={false}
      data-testid={props['data-testid']}
      onMouseDown={onMouseDown}
    />
  )
}
