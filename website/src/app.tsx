import { Editor, type MarkMode } from '@meowdown/react'
import { useState } from 'react'

interface ModeOption {
  value: MarkMode
  label: string
  description: string
}

const MODES: ModeOption[] = [
  {
    value: 'focus',
    label: 'Focus',
    description: 'Syntax stays hidden and peeks out only where your cursor rests.',
  },
  {
    value: 'show',
    label: 'Show',
    description: 'Every Markdown character stays visible, dimmed in soft grey.',
  },
  {
    value: 'hide',
    label: 'Hide',
    description: 'Markdown characters disappear for a clean, fully rendered view.',
  },
]

const INITIAL_CONTENT = `
# Welcome to Meowdown

A hybrid Markdown editor that renders as you type, so you never break your flow.

Weave in **bold**, *italic*, \`inline code\`, or ~~strikethrough~~ without reaching for a toolbar.

Drop a [link](https://github.com/prosekit/meowdown) and keep on writing.

> Switch modes above to choose how much Markdown syntax stays in view.
`

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800/80"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={
              active
                ? 'rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-900 shadow-sm transition-colors dark:bg-zinc-950 dark:text-white'
                : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function App() {
  const [mode, setMode] = useState<MarkMode>('focus')
  const activeMode = MODES.find((option) => option.value === mode) ?? MODES[0]

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
      <div className="mx-auto flex h-dvh max-w-3xl flex-col overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-xl dark:bg-zinc-800">
              🐱
            </span>
            <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Meowdown
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Work in progress
          </span>
        </header>

        <section className="mt-8 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:mt-10 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              <span className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span className="h-3 w-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span className="h-3 w-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              </span>
              <span>untitled.md</span>
            </div>
            <SegmentedControl
              ariaLabel="Markdown syntax visibility"
              options={MODES}
              value={mode}
              onChange={setMode}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Editor markMode={mode} initialContent={INITIAL_CONTENT} />
          </div>

          <div className="flex items-center gap-2 border-t border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              {activeMode.label}
            </span>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <span>{activeMode.description}</span>
          </div>
        </section>

        <footer className="mt-6 flex items-center justify-center gap-1.5 text-center text-sm text-zinc-500 sm:mt-8 dark:text-zinc-400">
          <span>View source on</span>
          <a
            href="https://github.com/prosekit/meowdown"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-900 hover:decoration-zinc-500 dark:text-zinc-200 dark:decoration-zinc-600 dark:hover:text-white dark:hover:decoration-zinc-400"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
              <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.16-.02-2.1-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.67 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.4-2.69 5.37-5.25 5.66.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
            </svg>
            <span>GitHub</span>
          </a>
        </footer>
      </div>
    </main>
  )
}
