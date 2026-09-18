import { expect, it } from 'vitest'

import { getEmbedUrl, getWatchUrl, parseYouTubeUrl } from './parse-url.ts'

it.each([
  'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  'https://youtube.com/watch?v=aqz-KE-bpKQ&list=abc',
  'https://m.youtube.com/watch?v=aqz-KE-bpKQ',
  'https://youtu.be/aqz-KE-bpKQ',
  'https://www.youtube.com/embed/aqz-KE-bpKQ',
  'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
  'https://www.youtube.com/live/aqz-KE-bpKQ',
])('parses the video id from %s', (url) => {
  expect(parseYouTubeUrl(url)).toEqual({
    videoId: 'aqz-KE-bpKQ',
    startSeconds: 0,
    short: false,
  })
})

it('marks Shorts URLs', () => {
  expect(parseYouTubeUrl('https://www.youtube.com/shorts/aqz-KE-bpKQ')).toEqual({
    videoId: 'aqz-KE-bpKQ',
    startSeconds: 0,
    short: true,
  })
})

it('parses start offsets', () => {
  expect(parseYouTubeUrl('https://youtu.be/aqz-KE-bpKQ?t=90')?.startSeconds).toBe(90)
  expect(parseYouTubeUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=1m30s')?.startSeconds).toBe(
    90,
  )
  expect(
    parseYouTubeUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ&start=3723')?.startSeconds,
  ).toBe(3723)
  expect(parseYouTubeUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=later')?.startSeconds).toBe(
    0,
  )
})

it.each([
  'https://www.youtube.com/watch?v=tooShort',
  'https://www.youtube.com/channel/aqz-KE-bpKQ',
  'https://example.com/watch?v=aqz-KE-bpKQ',
  'not a url',
  '',
])('rejects %s', (url) => {
  expect(parseYouTubeUrl(url)).toBeUndefined()
})

it('builds canonical watch and embed URLs', () => {
  const ref = { videoId: 'aqz-KE-bpKQ', startSeconds: 0, short: false }
  expect(getWatchUrl(ref)).toBe('https://www.youtube.com/watch?v=aqz-KE-bpKQ')
  expect(getEmbedUrl(ref)).toBe(
    'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?autoplay=1&playsinline=1',
  )
  const later = { videoId: 'aqz-KE-bpKQ', startSeconds: 90, short: false }
  expect(getWatchUrl(later)).toBe('https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=90')
  expect(getEmbedUrl(later)).toBe(
    'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?autoplay=1&playsinline=1&start=90',
  )
})
