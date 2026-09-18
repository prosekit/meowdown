import type { XPost, XPostAuthor, XPostMedia } from '@post-embed/types'

export interface XSample {
  name: string
  post: XPost | null
}

export function createXSamples(origin: string): XSample[] {
  const asset = (file: string) => new URL(`/embed/samples/${file}`, origin).href
  const mira: XPostAuthor = {
    name: 'Mira Okafor',
    handle: 'miraokafor',
    avatar: asset('avatar-a.svg'),
  }
  const trail: XPostAuthor = {
    name: 'Trail Notes',
    handle: 'trailnotes',
    avatar: asset('avatar-b.svg'),
  }
  const kai: XPostAuthor = {
    name: 'Kai Lindqvist',
    handle: 'kai_builds',
    avatar: asset('avatar-c.svg'),
  }
  const docs: XPostAuthor = {
    name: 'Docs Team',
    handle: 'docsteam',
    avatar: asset('avatar-d.svg'),
    avatarShape: 'square',
  }
  const photo = (file: string, width: number, height: number, alt: string): XPostMedia => ({
    type: 'photo',
    url: asset(file),
    width,
    height,
    alt,
  })
  const video = (poster: string, width: number, height: number, gif = false): XPostMedia => ({
    type: gif ? 'gif' : 'video',
    poster: asset(poster),
    width,
    height,
    sources: [
      {
        type: 'video/mp4',
        bitrate: 256000,
        url: new URL('/embed/media/motion.mp4', origin).href,
      },
    ],
  })
  let id = 1000
  const post = (author: XPostAuthor, text: string, extra: Partial<XPost> = {}): XPost => ({
    id: String(++id),
    createdAt: `2026-09-${String(10 + (id % 9)).padStart(2, '0')}T0${id % 9}:2${id % 7}:00.000Z`,
    lang: 'en',
    author,
    body: [{ type: 'text', text }],
    ...extra,
  })

  return [
    {
      name: 'Short reply',
      post: post(kai, 'Interesting perspective', {
        replyTo: { handle: 'miraokafor', id: '999' },
      }),
    },
    {
      name: 'Landscape video',
      post: post(
        mira,
        'Damn, the new vector model is 🔥\n\nIt is remarkably good at generating detailed SVGs, and it is very fun to watch it draw.\n\nI have been giving it random products and watching the model turn them into vector graphics 👇',
        { media: [video('landscape-1.svg', 1600, 900)] },
      ),
    },
    {
      name: 'Long text with links',
      post: {
        ...post(kai, ''),
        body: [
          {
            type: 'text',
            text: 'Introducing our first robot foundation model, zero-shot generalizing to any robot: table-top arms, industrial arms and humanoids.\n- learned directly from human manipulation data\n- no teleop or robot data\n- close to human-level dexterity and efficiency\n- multi-robot collab\n\nPaper and weights: ',
          },
          {
            type: 'link',
            text: 'example.com/om-1',
            url: 'https://example.com/om-1',
          },
          { type: 'text', text: ' ' },
          {
            type: 'link',
            text: '#robotics',
            url: 'https://x.com/hashtag/robotics',
          },
        ],
      },
    },
    {
      name: 'Landscape photo',
      post: post(trail, 'Same trail, ten minutes after sunrise 🌅', {
        media: [photo('landscape-2.svg', 1600, 900, 'Green hills by day')],
      }),
    },
    {
      name: 'Portrait photo',
      post: post(trail, 'Blue hour from the ridge.', {
        media: [photo('portrait-1.svg', 900, 1200, 'Hills at dusk')],
      }),
    },
    {
      name: 'Tall screenshot',
      post: post(kai, 'The new inbox ships today. Every row is keyboard reachable.', {
        media: [photo('phone.svg', 1170, 2532, 'A phone screenshot')],
      }),
    },
    {
      name: 'Wide strip',
      post: post(docs, 'your CI output clearly says it passed', {
        replyTo: { handle: 'kai_builds', id: '998' },
        media: [photo('strip.svg', 1056, 76, 'A terminal line')],
      }),
    },
    {
      name: 'Portrait video',
      post: post(mira, 'Morning fog rolling over the valley.', {
        media: [video('portrait-video.svg', 1080, 1920)],
      }),
    },
    {
      name: 'Two photos',
      post: post(trail, 'Two frames from this morning. Same trail.', {
        media: [
          photo('landscape-1.svg', 1600, 900, 'Hills at dawn'),
          photo('landscape-3.svg', 1600, 900, 'Hills at dusk'),
        ],
      }),
    },
    {
      name: 'Three photos',
      post: post(trail, 'Dawn, noon, dusk.', {
        media: [
          photo('portrait-1.svg', 900, 1200, 'Hills at dusk'),
          photo('landscape-2.svg', 1600, 900, 'Hills by day'),
          photo('landscape-1.svg', 1600, 900, 'Hills at dawn'),
        ],
      }),
    },
    {
      name: 'Four photos',
      post: post(trail, 'Four seasons on one ridge.', {
        media: [
          photo('landscape-1.svg', 1600, 900, 'Dawn'),
          photo('landscape-2.svg', 1600, 900, 'Day'),
          photo('landscape-3.svg', 1600, 900, 'Dusk'),
          photo('landscape-4.svg', 1600, 900, 'Mint'),
        ],
      }),
    },
    {
      name: 'Photo + quote with photo',
      post: post(docs, 'This is exactly the approach we wanted for the docs.', {
        edit: 'edited',
        media: [photo('chart.svg', 1600, 1000, 'A bar chart')],
        quote: post(
          mira,
          'Shipped a new version: paste saved post data into a custom element and get selectable text, with no requests at render time. It also works offline.',
          { media: [photo('square-1.svg', 1200, 1200, 'Hills by day')] },
        ),
      }),
    },
    {
      name: 'Text quote',
      post: post(kai, 'Worth reading twice.', {
        quote: post(
          mira,
          'Most performance work is deleting things. The fastest code is the code that never runs.',
        ),
      }),
    },
    {
      name: 'GIF',
      post: post(mira, 'me watching the deploy go green', {
        media: [video('square-1.svg', 1200, 1200, true)],
      }),
    },
    {
      name: 'Truncated',
      post: post(
        kai,
        'A long note about how we rebuilt the sync engine. We started with a simple last-writer-wins register and quickly found out that it was not enough for collaborative lists, so we moved to a sequence CRDT and then spent three months making it small',
        { truncated: true },
      ),
    },
    { name: 'Unavailable', post: null },
  ]
}
