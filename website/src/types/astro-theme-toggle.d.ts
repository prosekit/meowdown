// `ThemeScript` (astro-theme-toggle) installs this global. The package ships
// raw .ts source that NodeNext tsc cannot typecheck, so client code reads the
// global instead of importing `astro-theme-toggle/client`.
interface Window {
  astroThemeToggle?: {
    getTheme: () => 'light' | 'dark'
    setTheme: (theme: 'light' | 'dark') => void
  }
}
