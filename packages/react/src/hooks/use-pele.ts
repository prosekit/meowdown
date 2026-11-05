import { useEffect, useState } from 'react'

import type { PeleRender } from './pele-chunk.ts'

export { type PeleRender }

let pelePromise: Promise<PeleRender> | undefined

function loadPele(): Promise<PeleRender> {
  pelePromise ??= import('./pele-chunk.ts')
    .then((module) => module.render)
    .catch((error) => {
      console.error('[meowdown] Failed to load pele.', error)
      throw error
    })
  return pelePromise
}

export function usePele(enabled: boolean): PeleRender | undefined {
  const [renderer, setRenderer] = useState<PeleRender | undefined>(undefined)
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
