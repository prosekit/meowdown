import { Tooltip } from '@base-ui/react/tooltip'
import type { MouseEvent, ReactElement } from 'react'

const iconButtonClass =
  'flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-stone-200/80 bg-white/70 text-stone-500 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-stone-900 dark:border-stone-700/70 dark:bg-stone-900/70 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100'

function toggleTheme(event: MouseEvent<HTMLButtonElement>) {
  const ripple = window.astroThemeToggleClick
  if (ripple) {
    // Keyboard activation carries no pointer position; ripple from the button
    // center instead.
    const rect = event.currentTarget.getBoundingClientRect()
    const clientX = event.detail === 0 ? rect.left + rect.width / 2 : event.clientX
    const clientY = event.detail === 0 ? rect.top + rect.height / 2 : event.clientY
    ripple({ clientX, clientY })
    return
  }
  const themeToggle = window.astroThemeToggle
  if (themeToggle) {
    themeToggle.setTheme(themeToggle.getTheme() === 'dark' ? 'light' : 'dark')
  }
}

function IconTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup className="rounded-md bg-stone-800 px-2 py-1 text-xs font-medium text-stone-50 shadow-md dark:bg-stone-200 dark:text-stone-900">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function NavActions() {
  return (
    <Tooltip.Provider delay={300} closeDelay={100}>
      <div className="flex items-center gap-2">
        <IconTooltip label="Playground">
          <a href="/playground" aria-label="Playground" className={iconButtonClass}>
            <span className="i-lucide-flask-conical size-4.5" aria-hidden="true"></span>
          </a>
        </IconTooltip>
        <IconTooltip label="View source on GitHub">
          <a
            href="https://github.com/prosekit/meowdown"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
            className={iconButtonClass}
          >
            <span className="i-simple-icons-github size-4.5" aria-hidden="true"></span>
          </a>
        </IconTooltip>
        <IconTooltip label="Toggle color theme">
          <button
            type="button"
            aria-label="Toggle color theme"
            className={iconButtonClass}
            onClick={toggleTheme}
          >
            <span className="i-lucide-sun size-4.5 dark:hidden" aria-hidden="true"></span>
            <span
              className="i-lucide-moon hidden size-4.5 dark:inline-block"
              aria-hidden="true"
            ></span>
          </button>
        </IconTooltip>
      </div>
    </Tooltip.Provider>
  )
}
