import { Editor, type EditorMode } from '@meowdown/react'
import { type CSSProperties, useLayoutEffect, useState } from 'react'

interface ModeOption {
  value: EditorMode
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
  {
    value: 'source',
    label: 'Source',
    description: 'Raw Markdown with syntax highlighting, like an IDE.',
  },
]

const INITIAL_CONTENT = `
# Welcome to Meowdown

A hybrid Markdown editor that renders as you type, so you never break your flow.

Weave in **bold**, *italic*, \`inline code\`, or ~~strikethrough~~ without reaching for a toolbar.

Drop a [link](https://github.com/prosekit/meowdown) and keep on writing.

Label your notes with tags like #meow and #markdown. Type \`#\` followed by a letter to see suggestions.

Connect notes with wikilinks like [[Daily journal]] and [[Reading list]]. Type \`[[\` to link another note.

Paste or drop an image straight into the editor to embed it inline.

![A sunny placeholder photo](https://static.photos/yellow/640x360/42)

Drop in a fenced code block and pick its language from the selector:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

| table | syntax | is | supported |
| ----- | ------ | -- | --------- |
| even  | **in** | *tables* too! | :D |

> Switch modes above to choose how much Markdown syntax stays in view.
`

const TAGS = ['cats', 'editor', 'ideas', 'markdown', 'meow', 'notes', 'react', 'todo', 'work']

async function searchTags(query: string): Promise<string[]> {
  // Simulate network latency so the tag menu's loading state shows up.
  await new Promise((resolve) => setTimeout(resolve, 200))
  return TAGS.filter((tag) => tag.includes(query))
}

const NOTES = [
  'Cat care basics',
  'Daily journal',
  'Meeting notes',
  'Project ideas',
  'Reading list',
  'Travel plans',
]

async function searchNotes(query: string): Promise<string[]> {
  // Simulate network latency so the wikilink menu's loading state shows up.
  await new Promise((resolve) => setTimeout(resolve, 200))
  return NOTES.filter((note) => note.toLowerCase().includes(query))
}

// Demo upload: keep the pasted/dropped image for the session via a blob URL,
// which the default resolver passes straight through.
function uploadImage(file: File): string {
  return URL.createObjectURL(file)
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  /** Shared radio group name; required when several controls coexist. */
  name?: string
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  name = 'segmented-control',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="segmented"
      style={{ '--seg-count': options.length } as CSSProperties}
    >
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}

type Theme = 'light' | 'dark'

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

  // `dark` class drives Tailwind's `dark:` variant; `color-scheme` drives the
  // `light-dark()` colors in the stylesheets.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
  }, [theme])

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle color theme"
      title="Toggle color theme"
      className="absolute top-4 right-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-zinc-200 bg-white text-base shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  )
}

export function App() {
  const [mode, setMode] = useState<EditorMode>('focus')
  const activeMode = MODES.find((option) => option.value === mode) ?? MODES[0]

  return (
    <main className="relative min-h-dvh bg-zinc-50 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
      <ThemeToggle />
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2 sm:px-6 sm:py-2.5 dark:border-zinc-800">
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
            <Editor
              mode={mode}
              spellCheck={false}
              initialMarkdown={INITIAL_CONTENT}
              onTagSearch={searchTags}
              onWikilinkSearch={searchNotes}
              onImageUpload={uploadImage}
            />
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
