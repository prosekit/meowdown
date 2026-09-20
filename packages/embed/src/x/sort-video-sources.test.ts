import type { XPostVideoSource } from '@post-embed/types'
import { expect, it } from 'vitest'

import { sortVideoSources } from './sort-video-sources.ts'

const hls: XPostVideoSource = { type: 'application/x-mpegURL', url: 'https://example.com/a.m3u8' }
const low: XPostVideoSource = { type: 'video/mp4', url: 'https://example.com/low.mp4', bitrate: 1 }
const high: XPostVideoSource = { type: 'video/mp4', url: 'https://example.com/hi.mp4', bitrate: 9 }
const unknown: XPostVideoSource = { type: 'video/mp4', url: 'https://example.com/unknown.mp4' }

it('puts MP4 sources before HLS playlists', () => {
  expect(sortVideoSources([hls, low])).toEqual([low, hls])
})

it('puts the highest bitrate first and a missing bitrate last', () => {
  expect(sortVideoSources([unknown, low, high])).toEqual([high, low, unknown])
})

it('keeps the order of equal sources and leaves the input alone', () => {
  const other = { ...low, url: 'https://example.com/other.mp4' }
  const input = [hls, low, other]
  expect(sortVideoSources(input)).toEqual([low, other, hls])
  expect(input).toEqual([hls, low, other])
})
