import type { EmbedDescriptor, EmbedMatcher } from './embed-types.ts'
import { listenForTweetHeight, matchTweet } from './tweet.ts'
import { matchYouTube } from './youtube.ts'

export type { EmbedDescriptor } from './embed-types.ts'
export { listenForTweetHeight }

const EMBED_MATCHERS: readonly EmbedMatcher[] = [matchYouTube, matchTweet]

/** Detect a tweet/YouTube embed in an image `src`, or `undefined` for a plain image. */
export function matchEmbed(src: string): EmbedDescriptor | undefined {
  for (const match of EMBED_MATCHERS) {
    const descriptor = match(src)
    if (descriptor) return descriptor
  }
  return undefined
}
