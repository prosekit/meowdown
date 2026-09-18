import type { XPost, XPostMedia } from '@post-embed/types'

export function addMediaSnapshot(post: XPost, name: string): void {
  const asset = (file: string) => {
    return new URL(`/embed/media/${file}`, window.location.origin).href
  }
  post.author.avatar = asset('photo-1.svg')
  const photo = (index: number): XPostMedia => ({
    type: 'photo',
    url: asset(`photo-${index}.svg`),
    width: 640,
    height: 400,
    alt: `Illustrated landscape ${index}`,
  })
  const video = (gif = false): XPostMedia => ({
    type: gif ? 'gif' : 'video',
    poster: asset('photo-1.svg'),
    width: 640,
    height: 400,
    sources: [{ type: 'video/mp4', bitrate: 256000, url: asset('motion.mp4') }],
  })
  if (
    ['photo', 'two-photos', 'three-photos', 'four-photos', 'unavailable', 'broken-media'].includes(
      name,
    )
  ) {
    const count =
      name === 'two-photos' ? 2 : name === 'three-photos' ? 3 : name === 'four-photos' ? 4 : 1
    post.media = Array.from({ length: count }, (_, i) => photo(i + 1))
    if (name === 'unavailable') post.media[0].unavailable = true
    if (name === 'broken-media' && post.media[0].type === 'photo')
      post.media[0].url = asset('missing.svg')
  }
  if (name === 'video' || name === 'gif') post.media = [video(name === 'gif')]
  if (name === 'mixed-media') post.media = [photo(1), video(), photo(2)]
  if (name === 'quote') {
    post.quote = {
      ...structuredClone(post),
      id: '987654321',
      body: [{ type: 'text', text: 'A quoted post with a picture.' }],
      media: [photo(2)],
    }
  }
  if (name === 'reply') post.replyTo = { handle: 'example', id: '987654321' }
  if (name === 'square-avatar') post.author.avatarShape = 'square'
  if (name === 'edited') post.edit = 'edited'
  if (name === 'stale-edit') post.edit = 'stale'
  if (name === 'truncated') post.truncated = true
}
