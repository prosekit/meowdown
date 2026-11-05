import { useEffect, useState } from 'react'

import type { MermaidRenderer } from './pele-chunk.ts'

export { type MermaidRenderer }

let pelePromise: Promise<MermaidRenderer> | undefined

function loadPele(): Promise<MermaidRenderer> {
  pelePromise ??= import('./pele-chunk.ts')
    .then((module) => module.renderMermaid)
    .catch((error) => {
      console.error('[meowdown] Failed to load pele.', error)
      throw error
    })
  return pelePromise
}

export function usePele(enabled: boolean): MermaidRenderer | undefined {
  const [renderer, setRenderer] = useState<MermaidRenderer | undefined>(undefined)
  useEffect(() => {
    if (!enabled || renderer) return
    let cancelled = false
    void loadPele().then((loadedRenderer) => {
      if (!cancelled) setRenderer(() => loadedRenderer)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, renderer])
  return renderer
}
