import { useEffect, useState } from 'react'

// Astrobook hydrates stories with `client:load`, so every story component
// renders on the server first. Browser-only editors gate on this hook.
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
