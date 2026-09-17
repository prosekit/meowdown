import { describe, expect, it } from 'vitest'

import { matchEmbed } from './embed.ts'

describe('matchEmbed', () => {
  it('recognizes X posts', () => {
    expect(matchEmbed('https://x.com/jack/status/20')).toBe('x-post')
  })

  it('recognizes YouTube watch, short, shorts, embed, and live URLs', () => {
    expect(matchEmbed('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).toBe('youtube-video')
    expect(matchEmbed('https://youtu.be/aqz-KE-bpKQ')).toBe('youtube-video')
    expect(matchEmbed('https://www.youtube.com/shorts/aqz-KE-bpKQ')).toBe('youtube-video')
    expect(matchEmbed('https://www.youtube.com/embed/aqz-KE-bpKQ')).toBe('youtube-video')
    expect(matchEmbed('https://www.youtube.com/live/aqz-KE-bpKQ')).toBe('youtube-video')
  })

  it('declines plain images and other pages', () => {
    expect(matchEmbed('https://example.com/cat.png')).toBeUndefined()
    expect(matchEmbed('https://www.youtube.com/@Blender')).toBeUndefined()
    expect(matchEmbed('https://www.youtube.com/watch?v=short')).toBeUndefined()
  })
})
