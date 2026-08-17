// Local declaration for the `astro-theme-toggle/client` entry, mapped via the
// `paths` entry in tsconfig.json. The package ships raw .ts source whose
// extensionless internal imports NodeNext cannot typecheck; the bundler
// resolves the real module at build time.
export declare function handleToggleClick(event: { clientX: number; clientY: number }): void
export declare function getTheme(): 'light' | 'dark'
export declare function setTheme(theme: 'light' | 'dark'): void
