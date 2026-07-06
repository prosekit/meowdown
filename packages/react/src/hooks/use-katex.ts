import { loadKaTeX, type KaTeXRender } from '@meowdown/core'
import { useEffect, useState } from 'react'

/**
 * The lazily loaded KaTeX render function, or `undefined` while it loads (or when
 * `enabled` is false, so a document without math never loads it).
 */
export function useKaTeX(enabled: boolean): KaTeXRender | undefined {
  const [katex, setKaTeX] = useState<KaTeXRender | undefined>(undefined)
  useEffect(() => {
    if (!enabled || katex) return
    let cancelled = false
    void loadKaTeX().then((render) => {
      if (!cancelled) setKaTeX(() => render)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, katex])
  return katex
}
