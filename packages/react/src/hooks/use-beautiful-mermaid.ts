import type { renderMermaidSVG } from 'beautiful-mermaid'
import { useEffect, useState } from 'react'

export type BeautifulMermaidRender = typeof renderMermaidSVG

let beautifulMermaidPromise: Promise<BeautifulMermaidRender> | undefined

export function loadBeautifulMermaid(): Promise<BeautifulMermaidRender> {
  beautifulMermaidPromise ??= import('beautiful-mermaid')
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
