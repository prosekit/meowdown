import type { XPostVideoSource } from '@post-embed/types'

/**
 * Orders the sources the way a `<video>` should try them: it plays the first
 * `<source>` it supports, so MP4 files come before HLS playlists (which only
 * Safari plays natively), and within a type the highest bitrate comes first.
 * A source without a bitrate counts as 0. Returns a new array.
 */
export function sortVideoSources(sources: readonly XPostVideoSource[]): XPostVideoSource[] {
  return [...sources].sort((a, b) => {
    return (
      Number(b.type === 'video/mp4') - Number(a.type === 'video/mp4') ||
      (b.bitrate || 0) - (a.bitrate || 0)
    )
  })
}
