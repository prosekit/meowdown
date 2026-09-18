import type { XPost } from '@post-embed/types'

import { addMediaSnapshot } from './media-snapshots.ts'

function createPost(text = 'Hello 😀\nA saved post.'): XPost {
  return {
    id: '1234567890123456789',
    createdAt: '2026-09-10T00:00:00.000Z',
    lang: 'en',
    author: {
      name: 'Example Author',
      handle: 'example',
      avatar: 'https://example.com/avatar.jpg',
    },
    body: text ? [{ type: 'text', text }] : [],
  }
}

export type Snapshot =
  | 'plain'
  | 'links'
  | 'long'
  | 'rtl'
  | 'empty'
  | 'missing'
  | 'photo'
  | 'two-photos'
  | 'three-photos'
  | 'four-photos'
  | 'video'
  | 'gif'
  | 'mixed-media'
  | 'unavailable'
  | 'broken-media'
  | 'quote'
  | 'reply'
  | 'square-avatar'
  | 'edited'
  | 'stale-edit'
  | 'truncated'

export function createSnapshot(name: Snapshot): XPost | null {
  if (name === 'missing') return null
  const texts = {
    plain: 'Hello 😀 中文!\nTwo lines,  two spaces, and a saved snapshot.',
    long: ('A long paragraph with 中文 and emoji 😀. '.repeat(20) + '\n\n').repeat(10),
    rtl: 'مرحبا بالعالم\nنص عربي مع English و 😀',
    empty: '',
  }
  const post = createPost(
    Object.hasOwn(texts, name) ? texts[name as keyof typeof texts] : `Snapshot: ${name}`,
  )
  addMediaSnapshot(post, name)
  if (name === 'rtl') post.lang = 'ar'
  if (name === 'links') {
    post.body = [
      { type: 'text', text: '😀 ' },
      { type: 'link', text: '@example', url: 'https://x.com/example' },
      { type: 'text', text: ' ' },
      { type: 'link', text: '#Astro', url: 'https://x.com/hashtag/Astro' },
      { type: 'text', text: ' ' },
      { type: 'link', text: 'astro.build', url: 'https://astro.build/' },
    ]
  }
  return post
}
