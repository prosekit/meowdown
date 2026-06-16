import { matchTweet } from './tweet.ts'
import type { EmbedMatcher, EmbedRender } from './types.ts'
import { matchYouTube } from './youtube.ts'

export type { EmbedRender } from './types.ts'

const EMBED_MATCHERS: readonly EmbedMatcher[] = [matchYouTube, matchTweet]

export function matchEmbed(src: string): EmbedRender | undefined {
  for (const match of EMBED_MATCHERS) {
    const render = match(src)
    if (render) return render
  }
  return undefined
}
