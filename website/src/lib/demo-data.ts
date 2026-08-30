import type { LinkPreview, TagItem, WikilinkItem } from '@meowdown/react'
import { sleep } from '@ocavue/utils'

import catCareBasics from '../presets/notes/cat-care-basics.md?raw'
import dailyJournal from '../presets/notes/daily-journal.md?raw'
import meetingNotes from '../presets/notes/meeting-notes.md?raw'
import projectIdeas from '../presets/notes/project-ideas.md?raw'
import readingList from '../presets/notes/reading-list.md?raw'

import { uploadFile } from './upload-file.ts'

// Confirm, then open the target in a new tab. Shared by the link and image
// click handlers below.
function confirmAndOpen(label: string, url: string): void {
  if (window.confirm(`Open ${label} in a new tab?\n${url}`)) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export function handleLinkClick({ href }: { href: string }): void {
  confirmAndOpen('this link', href)
}

export function handleImageClick({ src }: { src: string }): void {
  confirmAndOpen('this image', src)
}

export function handleTagClick({ tag }: { tag: string }): void {
  window.alert(`Clicked tag: #${tag}`)
}

export function handleWikilinkClick({ target }: { target: string }): void {
  window.alert(`Clicked wikilink: ${target}`)
}

// Metadata for the link preview popup, derived from the URL itself so any
// typed link resolves without a per-site table. Stands in for the metadata
// fetch a real host would do.
export async function resolveLinkPreview(href: string): Promise<LinkPreview> {
  // Simulate a metadata round-trip so the loading skeleton shows up.
  await sleep(600)
  const hostname = new URL(href).hostname
  const label = hostname.replace(/^www\./, '').split('.')[0]
  return {
    title: label.charAt(0).toUpperCase() + label.slice(1),
    description: `Demo preview for ${href}`,
    iconSrc: `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
  }
}

// Demo note contents for the wikilink hover cards, one .md file per note
// under `presets/notes/` (out of the preset glob's reach: these are a fixed
// set, not playground presets). `Travel plans` is left out on purpose: a
// target without content renders no card.
export const NOTE_PREVIEWS: Record<string, string> = {
  'Cat care basics': catCareBasics,
  'Daily journal': dailyJournal,
  'Meeting notes': meetingNotes,
  'Project ideas': projectIdeas,
  'Reading list': readingList,
}

// Sizes for the file pills: the demo file in the default preset, plus every
// upload recorded by `uploadAndTrackFile`. Stands in for the stat lookup a
// real host would do.
const FILE_SIZE_BY_HREF = new Map<string, number>([['files/meowdown-press-kit.zip', 3_481_294]])

export function resolveFileLink({ href }: { href: string }): boolean {
  return href.startsWith('files/') || href.includes('tmpfiles.org/dl/')
}

export async function resolveFileInfo(href: string): Promise<{ size: number } | undefined> {
  // Simulate a stat round-trip so the size visibly fills in after the pill.
  await new Promise((resolve) => setTimeout(resolve, 300))
  const size = FILE_SIZE_BY_HREF.get(href)
  return size == null ? undefined : { size }
}

export async function uploadAndTrackFile(file: File): Promise<string> {
  const url = await uploadFile(file)
  FILE_SIZE_BY_HREF.set(url, file.size)
  return url
}

export function handleFileClick({ name, href }: { name: string; href: string }): void {
  if (/^https?:\/\//i.test(href)) {
    confirmAndOpen(`the file "${name}"`, href)
  } else {
    window.alert(`Clicked file: ${name} (${href})`)
  }
}

const TAGS = ['cats', 'editor', 'ideas', 'markdown', 'meow', 'notes', 'react', 'todo', 'work']

export async function searchTags(query: string): Promise<TagItem[]> {
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

export async function searchNotes(query: string): Promise<WikilinkItem[]> {
  // Simulate network latency so the wikilink menu's loading state shows up.
  await new Promise((resolve) => setTimeout(resolve, 200))
  const normalizedQuery = query.toLowerCase()
  const items: WikilinkItem[] = NOTES.filter((note) => { return note.toLowerCase().includes(normalizedQuery) },
  ).map((note) => ({ target: note }))
  // A trailing create row keeps Enter useful when nothing matches the typed
  // title exactly, like a real notes app.
  const title = query.trim()
  if (title !== '' && !NOTES.some((note) => note.toLowerCase() === title.toLowerCase())) {
    items.push({
      target: title,
      label: `Create “${title}”`,
      onSelect: () => {
        NOTES.push(title)
      },
    })
  }
  return items
}
