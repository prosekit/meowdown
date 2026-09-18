import './stories.css'

import { registerXPost } from '@meowdown/embed/x'
import { registerYouTubeVideo } from '@meowdown/embed/youtube'
import { createElement, type ReactElement, type ReactNode } from 'react'

import { useMounted } from '../lib/use-mounted.ts'

import { createSnapshot, type Snapshot } from './embed-samples/snapshots.ts'
import { createXSamples } from './embed-samples/x-samples.ts'
import { createYouTubeSnapshot } from './embed-samples/youtube-snapshots.ts'

export interface EmbedGalleryProps {
  kind: 'x' | 'youtube'
}

interface GalleryItem {
  name: string
  card: ReactElement
}

// The shapes the samples do not cover. The very long post goes last so it
// does not push the rest away.
const X_EDGE_CASES = [
  'plain',
  'links',
  'rtl',
  'empty',
  'mixed-media',
  'unavailable',
  'broken-media',
  'square-avatar',
  'edited',
  'stale-edit',
  'long',
] as const satisfies Snapshot[]

// The X card sizes itself; the editor wraps it in an inline-block span.
function getXItems(): GalleryItem[] {
  // Registration must precede the element so React sets `data` as a property.
  registerXPost()
  const posts = [
    ...createXSamples(window.location.origin),
    ...X_EDGE_CASES.map((name) => ({ name, post: createSnapshot(name) })),
  ]
  return posts.map(({ name, post }) => ({
    name,
    card: (
      <span className="inline-block max-w-full align-bottom">
        {createElement('meowdown-embed-x', { data: post })}
      </span>
    ),
  }))
}

const YOUTUBE_SNAPSHOTS = [
  'basic',
  'long-title',
  'short',
  'start-time',
  'no-author',
  'missing',
] as const

// The video card fills its container; the editor gives it this default width.
const YOUTUBE_STYLE = { display: 'block', maxWidth: 550 }

function getYouTubeItems(): GalleryItem[] {
  registerYouTubeVideo()
  return [
    ...YOUTUBE_SNAPSHOTS.map((name) => ({
      name,
      card: createElement('meowdown-embed-youtube', {
        data: createYouTubeSnapshot(name),
        style: YOUTUBE_STYLE,
      }),
    })),
    {
      name: 'inline playback',
      card: createElement('meowdown-embed-youtube', {
        data: createYouTubeSnapshot('basic'),
        playback: 'inline',
        style: YOUTUBE_STYLE,
      }),
    },
  ]
}

function GalleryFigure({ name, children }: { name: string; children: ReactNode }) {
  return (
    <figure className="m-0">
      <figcaption className="mb-1.5 text-xs tracking-wide text-stone-500 uppercase dark:text-stone-400">
        {name}
      </figcaption>
      {children}
    </figure>
  )
}

export function EmbedGallery({ kind }: EmbedGalleryProps) {
  // The samples read `window.location.origin`, so they cannot prerender.
  const mounted = useMounted()
  if (!mounted) return null
  const items = kind === 'x' ? getXItems() : getYouTubeItems()
  return (
    <div className="flex max-w-xl flex-col gap-6 p-6 text-base text-stone-900 dark:text-stone-100">
      {items.map((item) => (
        <GalleryFigure key={item.name} name={item.name}>
          {item.card}
        </GalleryFigure>
      ))}
    </div>
  )
}
