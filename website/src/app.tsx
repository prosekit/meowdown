import {
  Editor,
  type EditorMode,
  type LinkClickHandler,
  type LinkHoverHandler,
  type WikilinkClickHandler,
  type WikilinkHoverHandler,
} from '@meowdown/react'
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useState } from 'react'

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

Click into the editor, then hover a [link](https://prosekit.dev) or a [[wikilink]] to preview it. Hold Cmd (or Ctrl) and click to open.

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

const NOTE_EXCERPTS: Record<string, string> = {
  'Cat care basics': 'Feeding schedules, grooming, and vet visit reminders.',
  'Daily journal': "Today's wins, blockers, and one line of gratitude.",
  'Meeting notes': 'Decisions and action items from this week.',
  'Project ideas': 'A running list of things to build someday.',
  'Reading list': 'Books and articles queued up for later.',
  'Travel plans': 'Flights, lodging, and a loose itinerary.',
}

function noteExists(target: string): boolean {
  return NOTES.some((note) => note.toLowerCase() === target.toLowerCase())
}

function urlHost(href: string): string {
  try {
    return new URL(href).host
  } catch {
    return href
  }
}

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  maxWidth: '15rem',
  padding: '0.5rem 0.625rem',
}
const cardTitleStyle: CSSProperties = { fontWeight: 600, color: 'var(--meowdown-heading)' }
const cardMetaStyle: CSSProperties = { fontSize: '0.75rem', color: 'var(--meowdown-muted)' }
const cardBodyStyle: CSSProperties = { fontSize: '0.8125rem', lineHeight: 1.4 }
const ellipsisStyle: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

// A custom hover card for wikilinks: a note preview the app builds from its own
// data. Returned from `onWikilinkHover`.
function NotePreview({ target }: { target: string }) {
  return (
    <div style={cardStyle}>
      <span style={cardTitleStyle}>{target}</span>
      <span style={cardMetaStyle}>
        {noteExists(target) ? 'Note in your vault' : 'New note, not created yet'}
      </span>
      <span style={cardBodyStyle}>
        {NOTE_EXCERPTS[target] ?? 'No preview yet. Cmd/Ctrl-click to create it.'}
      </span>
    </div>
  )
}

// A custom hover card for Markdown links. Returned from `onLinkHover`. Omit the
// prop to get meowdown's built-in card (the URL plus Edit / Copy / Open).
function LinkPreview({ href }: { href: string }) {
  return (
    <div style={cardStyle}>
      <span style={cardTitleStyle}>{urlHost(href)}</span>
      <span style={{ ...cardMetaStyle, ...ellipsisStyle }}>{href}</span>
      <span style={cardMetaStyle}>Cmd/Ctrl-click to open</span>
    </div>
  )
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

  // Transient feedback so click handlers have a visible effect in the demo.
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(id)
  }, [toast])

  const handleWikilinkHover = useCallback<WikilinkHoverHandler>(async ({ target, signal }) => {
    // Simulate fetching the note so the card's loading state shows.
    await new Promise((resolve) => setTimeout(resolve, 250))
    if (signal.aborted) return null
    return <NotePreview target={target} />
  }, [])

  const handleLinkHover = useCallback<LinkHoverHandler>(
    ({ href }) => <LinkPreview href={href} />,
    [],
  )

  const handleWikilinkClick = useCallback<WikilinkClickHandler>(({ target }) => {
    setToast(`Opening note: ${target}`)
  }, [])

  const handleLinkClick = useCallback<LinkClickHandler>(({ href }) => {
    setToast(`Opening link: ${href}`)
    window.open(href, '_blank', 'noopener')
  }, [])

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
              onLinkHover={handleLinkHover}
              onLinkClick={handleLinkClick}
              onWikilinkHover={handleWikilinkHover}
              onWikilinkClick={handleWikilinkClick}
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

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          {toast}
        </div>
      )}
    </main>
  )
}
