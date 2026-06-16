import { describe, expect, it } from 'vitest'

import { matchYouTube } from './youtube.ts'

describe('matchYouTube', () => {
  const getKey = (src: string) => matchYouTube(src)?.key

  it('matches the standard watch URL', () => {
    expect(getKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube:dQw4w9WgXcQ:0')
  })

  it.each([
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
  ])('matches %s', (src) => {
    expect(getKey(src)).toBe('youtube:dQw4w9WgXcQ:0')
  })

  it('carries a start time (t=90, t=1m30s)', () => {
    expect(getKey('https://youtu.be/dQw4w9WgXcQ?t=90')).toBe('youtube:dQw4w9WgXcQ:90')
    expect(getKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s')).toBe(
      'youtube:dQw4w9WgXcQ:90',
    )
  })

  it('declines non-YouTube and malformed ids', () => {
    expect(matchYouTube('https://example.com/watch?v=dQw4w9WgXcQ')).toBeUndefined()
    expect(matchYouTube('https://www.youtube.com/watch?v=tooShort')).toBeUndefined()
    expect(matchYouTube('not a url')).toBeUndefined()
  })

  it('renders a nocookie embed iframe', () => {
    const element = matchYouTube('https://youtu.be/dQw4w9WgXcQ')!.render() as HTMLIFrameElement
    expect(element.tagName).toBe('IFRAME')
    expect(element.src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(element.getAttribute('loading')).toBe('lazy')
    expect(element.allowFullscreen).toBe(true)
  })

  it('passes the start time through to the embed src', () => {
    const element = matchYouTube('https://youtu.be/dQw4w9WgXcQ?t=90')!.render() as HTMLIFrameElement
    expect(element.src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90')
  })
})
