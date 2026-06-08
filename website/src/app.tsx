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
      <div className="mx-auto flex h-dvh max-w-3xl flex-col overflow-hidden px-4 py-9 sm:px-8 sm:py-16 lg:py-20">
        <header className="flex flex-col items-center gap-4 text-center sm:gap-5">
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

        <section className="mt-9 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:mt-14 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3.5 sm:px-6 sm:py-4 dark:border-zinc-800">
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

          <div className="flex items-center gap-2 border-t border-zinc-200 bg-zinc-50/80 px-4 py-3.5 text-sm sm:px-6 sm:py-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              {activeMode.label}
            </span>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <span>{activeMode.description}</span>
          </div>
        </section>

        <footer className="mt-6 flex justify-center sm:mt-8">
          <a
            href="https://github.com/prosekit/meowdown"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <span className="i-simple-icons-github size-3.5" aria-hidden="true" />
            <span>View source on GitHub</span>
          </a>
        </footer>
      </div>
    </main>
  )
}
