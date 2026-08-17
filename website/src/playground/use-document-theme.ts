import { useEffect, useState } from 'react'

function readTheme(): 'light' | 'dark' {
  const themeToggle = window.astroThemeToggle
  return themeToggle ? themeToggle.getTheme() : 'light'
}

// astro-theme-toggle fires no event; the documented hook is the `data-theme`
// attribute its ThemeScript writes on <html>.
export function useDocumentTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return theme
}
