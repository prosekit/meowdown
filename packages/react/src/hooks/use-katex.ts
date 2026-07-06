import { loadKaTeX, type KaTeX } from '@meowdown/core'
import { useEffect, useState } from 'react'

/**
 * The lazily loaded KaTeX module, or `undefined` while it loads (or when
 * `enabled` is false, so a document without math never loads it).
 */
export function useKaTeX(enabled: boolean): KaTeX | undefined {
  const [katex, setKaTeX] = useState<KaTeX | undefined>(undefined)
  useEffect(() => {
    if (!enabled || katex) return
    let cancelled = false
    void loadKaTeX().then((module) => {
      if (!cancelled) setKaTeX(module)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, katex])
  return katex
}
