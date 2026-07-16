import { useEffect, useState } from 'react'

import type { BeautifulMermaidRender } from './beautiful-mermaid-chunk.ts'

export { type BeautifulMermaidRender }

let beautifulMermaidPromise: Promise<BeautifulMermaidRender> | undefined

function loadBeautifulMermaid(): Promise<BeautifulMermaidRender> {
  beautifulMermaidPromise ??= import('./beautiful-mermaid-chunk.ts')
    .then((module) => module.renderMermaidSVG)
    .catch((error) => {
      console.error('[meowdown] Failed to load beautiful-mermaid.', error)
      throw error
    })
  return beautifulMermaidPromise
}

export function useBeautifulMermaid(enabled: boolean): BeautifulMermaidRender | undefined {
  const [renderer, setRenderer] = useState<BeautifulMermaidRender | undefined>(undefined)
  useEffect(() => {
    if (!enabled || renderer) return
    let cancelled = false
    void loadBeautifulMermaid()
      .then((loadedRenderer) => {
        if (!cancelled) setRenderer(() => loadedRenderer)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [enabled, renderer])
  return renderer
}
