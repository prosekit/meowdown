import { prefersDarkColorScheme } from '../utils/prefers-dark-color-scheme.ts'

import type { EmbedMatcher } from './embed-types.ts'

const TWEET_HOSTS = /^(?:www\.|mobile\.)?(?:twitter\.com|x\.com)$/i
const STATUS_ID = /\/status(?:es)?\/(\d+)/

function parseTweetId(src: string): string | undefined {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return undefined
  }
  if (!TWEET_HOSTS.test(url.hostname)) return undefined
  return STATUS_ID.exec(url.pathname)?.[1]
}

export const matchTweet: EmbedMatcher = (src) => {
  const tweetId = parseTweetId(src)
  if (!tweetId) return
  const theme = prefersDarkColorScheme() ? 'dark' : 'light'
  return {
    kind: 'tweet',
    key: `tweet:${tweetId}`,
    // First-party embed endpoint; renders the tweet with no global script.
    src: `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=${theme}&dnt=true`,
    title: 'Tweet',
    className: 'md-embed md-embed-tweet',
    testid: 'tweet-embed',
  }
}

/**
 * `Tweet.html` reports its rendered height via `postMessage`; size the iframe to
 * fit. Returns a cleanup that removes the listener. The cleanup also runs once
 * the iframe leaves the DOM, so the editor's DOM mark view (which has no destroy
 * hook) is covered, while a React caller can call it on unmount.
 */
export function listenForTweetHeight(iframe: HTMLIFrameElement): () => void {
  const onMessage = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow) return
    try {
      interface TweetResizeMessage {
        'twttr.embed'?: {
          method?: string
          params?: Array<{ height?: number }>
        }
      }
      const message = event.data as TweetResizeMessage | null
      const height = message?.['twttr.embed']?.params?.[0]?.height
      if (typeof height === 'number') iframe.style.height = `${height}px`
    } catch (error) {
      console.warn('[meowdown] failed to parse tweet resize message:', error)
    }
  }
  window.addEventListener('message', onMessage)
  let cleaned = false
  const cleanup = (): void => {
    if (cleaned) return
    cleaned = true
    window.removeEventListener('message', onMessage)
    observer.disconnect()
  }
  // Drop the listener once the iframe leaves the DOM (decoration rebuilt/removed).
  const observer = new MutationObserver(() => {
    if (!iframe.isConnected) cleanup()
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return cleanup
}
