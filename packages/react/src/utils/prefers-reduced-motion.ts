export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch (error) {
    console.warn('[meowdown] Failed to read prefers-reduced-motion:', error)
    return false
  }
}
