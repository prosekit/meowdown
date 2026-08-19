import type { TagItem, WikilinkItem } from '@meowdown/react'

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

// REVIEW: put these content into the presets dir, and import them directly (i.g. do not use the presets.ts to import these content because we have a fixed set of content for the demo)
// Demo note contents for the wikilink hover cards. `Travel plans` is left out
// on purpose: a target without content renders no card.
export const NOTE_PREVIEWS: Record<string, string> = {
  'Cat care basics': `# Cat care basics

Feed twice a day, fresh water always, and never skip **play time**.

- Brush long-haired cats daily
- Scratching posts save the couch`,
  'Daily journal': `# Daily journal

Slow morning, good coffee. Sketched the outline for the #meowdown demo and moved [[Project ideas]] forward.

+ [x] Morning pages
+ [ ] Publish the changelog`,
  'Meeting notes': `# Meeting notes

Agreed to ship the hover card demo this week. *Everyone* liked the passive preview approach.`,
  'Project ideas': `# Project ideas

- A cozy reading nook
- A cat-shaped bookshelf
- A tiny herb garden`,
  'Reading list': `# Reading list

1. *The Mythical Man-Month*
2. [CommonMark spec](https://commonmark.org)
3. ~~Working in Public~~ (finished!)`,
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
  const items: WikilinkItem[] = NOTES.filter((note) =>
    note.toLowerCase().includes(normalizedQuery),
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
