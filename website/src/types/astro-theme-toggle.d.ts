// `ThemeScript` (astro-theme-toggle) installs this global. The package ships
// raw .ts source that NodeNext tsc cannot typecheck, so client code reads the
// global instead of importing `astro-theme-toggle/client`.
// REVIEW: I don't knonw what do you mean by this. Just use astro-theme-toggle/client directly. You're allow to break the CI. so that I knonw what you mean. I can fix the astro-theme-toggle lib later myself.
interface Window {
  astroThemeToggle?: {
    getTheme: () => 'light' | 'dark'
    setTheme: (theme: 'light' | 'dark') => void
  }
  // Bridged from `astro-theme-toggle/client` by a script in `index.astro`:
  // the toggle click handler that runs the circular view-transition reveal.
  astroThemeToggleClick?: (event: { clientX: number; clientY: number }) => void
}
