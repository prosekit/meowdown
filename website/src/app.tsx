import type { ExitBoundaryHandler } from '@meowdown/core'
import type { EditorHandle, TagItem, WikilinkItem } from '@meowdown/react'
import { getId } from '@ocavue/utils'
import { clsx } from 'clsx/lite'
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { DemoEditor } from './components/demo-editor.tsx'
import { SelectionMenuShortcut, useSelectionDemo } from './selection-demo.tsx'
import { uploadFile } from './upload-file.ts'
import { MODES, useEditorMode } from './use-editor-mode.ts'

// Confirm, then open the target in a new tab. Shared by the link and image
// click handlers below.
function confirmAndOpen(label: string, url: string): void {
  if (window.confirm(`Open ${label} in a new tab?\n${url}`)) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function handleLinkClick({ href }: { href: string }): void {
  confirmAndOpen('this link', href)
}

function handleImageClick({ src }: { src: string }): void {
  confirmAndOpen('this image', src)
}

function handleTagClick({ tag }: { tag: string }): void {
  window.alert(`Clicked tag: #${tag}`)
}

function handleWikilinkClick({ target }: { target: string }): void {
  window.alert(`Clicked wikilink: ${target}`)
}

// Sizes for the file pills: the demo file in INITIAL_CONTENT, plus every
// upload recorded by `uploadAndTrackFile`. Stands in for the stat lookup a
// real host would do.
const FILE_SIZE_BY_HREF = new Map<string, number>([['files/meowdown-press-kit.zip', 3_481_294]])

function resolveFileLink({ href }: { href: string }): boolean {
  return href.startsWith('files/') || href.includes('tmpfiles.org/dl/')
}

async function resolveFileInfo(href: string): Promise<{ size: number } | undefined> {
  // Simulate a stat round-trip so the size visibly fills in after the pill.
  await new Promise((resolve) => setTimeout(resolve, 300))
  const size = FILE_SIZE_BY_HREF.get(href)
  return size == null ? undefined : { size }
}

async function uploadAndTrackFile(file: File): Promise<string> {
  const url = await uploadFile(file)
  FILE_SIZE_BY_HREF.set(url, file.size)
  return url
}

function handleFileClick({ name, href }: { name: string; href: string }): void {
  if (/^https?:\/\//i.test(href)) {
    confirmAndOpen(`the file "${name}"`, href)
  } else {
    window.alert(`Clicked file: ${name} (${href})`)
  }
}

const INITIAL_CONTENT = `
# Welcome to Meowdown

A hybrid Markdown editor that renders as you type, so you never break your flow.

Weave in **bold**, *italic*, \`inline code\`, or ~~strikethrough~~ without reaching for a toolbar.

Drop a [link](https://github.com/prosekit/meowdown) and keep on writing.

Label your notes with tags like #meow and #markdown. Type \`#\` followed by a letter to see suggestions.

Connect notes with wikilinks like [[Daily journal]] and [[Reading list]]. Type \`[[\` to link another note.

Select some text and click the sparkle button (or press \`Mod-Shift-J\`) to run a command on it. The result streams into a preview, and nothing changes until you accept it.

Track things two ways. Type \`+ \` for a circle checkbox task, or \`[] \` for a square checkbox task:

+ [ ] Ship the circle task
+ [x] Read the research doc
- [ ] Buy cat food
- [x] Water the plants

Outline your thoughts with nested bullets. Hover a bullet that has children and click it (or press \`Mod-.\`) to fold. A folded bullet is saved with a \`+\` marker, so it stays folded next time:

- Project ideas
  - A cozy reading nook
  - A cat-shaped bookshelf
- Groceries
  - Cat food
  - Houseplants
+ This one is already folded (click to expand)
  - Hidden child one
  - Hidden child two

Drop in an image and it renders right where you wrote it. Paste or drag one in to upload your own:

Small images flow inline ![](https://static.photos/yellow/16x16/3) with the surrounding text.

Paste a YouTube or tweet link and it embeds itself. Undo once to get the plain link back:

![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)

![](https://twitter.com/jack/status/20)

A link to a file renders as a tidy pill, with its size filled in by the host. Paste or drop any non-image file to add your own, and click a pill to open it:

[Meowdown press kit.zip](files/meowdown-press-kit.zip)

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

async function searchTags(query: string): Promise<TagItem[]> {
  // Simulate network latency so the tag menu's loading state shows up.
  await new Promise((resolve) => setTimeout(resolve, 200))
  return TAGS.filter((tag) => tag.includes(query)).map((tag) => ({ tag }))
}

const NOTES = [
  'Cat care basics',
  'Daily journal',
  'Meeting notes',
  'Project ideas',
  'Reading list',
  'Travel plans',
]

async function searchNotes(query: string): Promise<WikilinkItem[]> {
  // Simulate network latency so the wikilink menu's loading state shows up.
  await new Promise((resolve) => setTimeout(resolve, 200))
  const normalizedQuery = query.toLowerCase()
  return NOTES.filter((note) => note.toLowerCase().includes(normalizedQuery)).map((note) => ({
    target: note,
  }))
}

const ICON_BUTTON_CLASS =
  'flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-stone-200/80 bg-white/70 text-stone-500 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-stone-900 dark:border-stone-700/70 dark:bg-stone-900/70 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100'

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
      className={ICON_BUTTON_CLASS}
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-100 text-lg shadow-sm shadow-amber-500/30">
        🐱
      </span>
      <span className="text-lg font-semibold tracking-tight text-stone-900 dark:text-white">
        Meowdown
      </span>
      <span className="hidden items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 sm:inline-flex dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Work in progress
      </span>
    </div>
  )
}

export function App() {
  const { mode, setMode, activeMode } = useEditorMode()

  const editorRef = useRef<EditorHandle>(null)
  const selectionDemo = useSelectionDemo(editorRef)

  const [spellCheck, setSpellCheck] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const id = setTimeout(() => {
      const urlParams = new URLSearchParams(window.location.search)
      const value = urlParams.get('spellcheck') || urlParams.get('spellCheck')

      if (value === 'true') {
        setSpellCheck(true)
        console.log('[meowdown] Spellcheck enabled')
      } else if (value === 'false') {
        setSpellCheck(false)
        console.log('[meowdown] Spellcheck disabled')
      } else if (value) {
        console.warn(
          `[meowdown] Invalid spellcheck value in URL query: ${value}. Expected "true" or "false".`,
        )
      }
    }, 0)

    return () => {
      clearTimeout(id)
    }
  }, [])

  // When the caret leaves the document boundary (onExitBoundary), briefly flash
  // a top or bottom border inside the editor box. A bumped id remounts the
  // overlay so its one-shot fade restarts on every press.
  const [edgeFlash, setEdgeFlash] = useState<{ id: number; direction: 'up' | 'down' }>()
  const handleExitBoundary: ExitBoundaryHandler = useCallback(({ direction }) => {
    setEdgeFlash({ id: getId(), direction })
  }, [])

  return (
    <main className="relative min-h-dvh overflow-hidden text-stone-600 dark:bg-stone-950">
      <div className="relative mx-auto flex h-dvh max-w-5xl flex-col px-4 py-5 sm:px-6 sm:py-7">
        <nav className="flex shrink-0 items-center justify-between">
          <Brand />
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/prosekit/meowdown"
              target="_blank"
              rel="noreferrer"
              aria-label="View source on GitHub"
              title="View source on GitHub"
              className={ICON_BUTTON_CLASS}
            >
              <span className="i-simple-icons-github size-4" aria-hidden="true" />
            </a>
            <ThemeToggle />
          </div>
        </nav>

        <header className="shrink-0 py-5 text-center sm:py-6">
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-stone-900 sm:text-4xl dark:text-white">
            Markdown that{' '}
            <span className="text-amber-500 dark:text-amber-400">renders as you type</span>
          </h1>
        </header>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-2xl shadow-orange-500/20 ring-1 ring-black/5 dark:border-stone-800 dark:bg-stone-900 dark:shadow-black/40 dark:ring-white/5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 bg-stone-50/60 px-4 py-2.5 sm:px-5 dark:border-stone-800 dark:bg-stone-950/30">
            <div className="flex items-center gap-2.5 text-sm font-medium text-stone-500 dark:text-stone-400">
              <span className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-400 ring-1 ring-black/10 ring-inset" />
                <span className="h-3 w-3 rounded-full bg-amber-400 ring-1 ring-black/10 ring-inset" />
                <span className="h-3 w-3 rounded-full bg-green-400 ring-1 ring-black/10 ring-inset" />
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

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <DemoEditor
                mode={mode}
                spellCheck={spellCheck}
                initialMarkdown={INITIAL_CONTENT}
                handleRef={editorRef}
                slashMenuTrigger
                onTagSearch={searchTags}
                onWikilinkSearch={searchNotes}
                onSelectionMenuSearch={selectionDemo.onSelectionMenuSearch}
                pendingReplacementActions={selectionDemo.pendingReplacementActions}
                onPendingReplacementResolve={selectionDemo.onPendingReplacementResolve}
                onFilePaste={uploadAndTrackFile}
                resolveFileLink={resolveFileLink}
                resolveFileInfo={resolveFileInfo}
                onFileClick={handleFileClick}
                onImageClick={handleImageClick}
                onLinkClick={handleLinkClick}
                onTagClick={handleTagClick}
                onWikilinkClick={handleWikilinkClick}
                onExitBoundary={handleExitBoundary}
              >
                <SelectionMenuShortcut onTrigger={selectionDemo.openMenu} />
              </DemoEditor>
            </div>

            {edgeFlash && (
              <div
                key={edgeFlash.id}
                onAnimationEnd={() => setEdgeFlash(undefined)}
                aria-hidden
                className={clsx(
                  'edge-border',
                  'border-0 pointer-events-none absolute inset-0 z-10',
                  'border-(--meowdown-accent)',
                  edgeFlash.direction === 'up' ? 'border-t-2' : 'border-b-2',
                )}
              />
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-stone-200/80 bg-stone-50/60 px-4 py-3 text-sm sm:px-5 dark:border-stone-800 dark:bg-stone-950/30">
            <span key={mode} className="mode-desc flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-semibold text-stone-700 dark:text-stone-200">
                {activeMode.label}
              </span>
              <span className="text-stone-300 dark:text-stone-600">·</span>
              <span className="text-stone-500 dark:text-stone-400">{activeMode.description}</span>
            </span>
          </div>
        </section>

        <footer className="shrink-0 pt-4 text-center text-xs text-stone-400 dark:text-stone-600">
          Built with{' '}
          <a
            href="https://prosekit.dev"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-stone-500 underline-offset-2 transition-colors hover:text-stone-700 hover:underline dark:text-stone-500 dark:hover:text-stone-300"
          >
            ProseKit
          </a>
        </footer>
      </div>
    </main>
  )
}
