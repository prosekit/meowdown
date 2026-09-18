import type { XPost, XPostMedia } from '@post-embed/types'

export function createPost(text = 'Hello 😀\nA saved post.'): XPost {
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

export function createPhoto(): Extract<XPostMedia, { type: 'photo' }> {
  return {
    type: 'photo',
    url: new URL('./image.svg?no-inline', import.meta.url).href,
    width: 640,
    height: 400,
    alt: 'Blue illustrated mountains',
  }
}

export function createVideo(gif = false): Extract<XPostMedia, { type: 'video' | 'gif' }> {
  return {
    type: gif ? 'gif' : 'video',
    poster: createPhoto().url,
    width: 640,
    height: 400,
    sources: [
      { type: 'application/x-mpegURL', url: 'https://example.com/video.m3u8' },
      { type: 'video/mp4', bitrate: 200, url: 'https://example.com/high.mp4' },
      { type: 'video/mp4', bitrate: 100, url: 'https://example.com/low.mp4' },
    ],
  }
}
