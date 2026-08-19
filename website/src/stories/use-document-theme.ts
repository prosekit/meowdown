import { getTheme } from 'astro-theme-toggle/client'
import { useEffect, useState } from 'react'

// astro-theme-toggle fires no event; the documented hook is the `data-theme`
// attribute its ThemeScript writes on <html>.
export function useDocumentTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState(getTheme)

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return theme
}
