/**
 * Whether the user prefers a dark color scheme. Returns `false` in non-browser
 * (SSR) environments where `window` is unavailable.
 */
export function prefersDarkColorScheme(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
