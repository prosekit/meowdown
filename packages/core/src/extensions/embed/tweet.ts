import type { EmbedMatcher } from './types.ts'

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

function prefersDarkColorScheme(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const matchTweet: EmbedMatcher = (src) => {
  const tweetId = parseTweetId(src)
  if (!tweetId) return undefined
  return {
    key: `tweet:${tweetId}`,
    render: () => {
      const theme = prefersDarkColorScheme() ? 'dark' : 'light'
      const iframe = document.createElement('iframe')
      // First-party embed endpoint; renders the tweet with no global script.
      iframe.src = `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=${theme}&dnt=true`
      iframe.title = 'Tweet'
      iframe.className = 'md-embed md-embed-tweet'
      iframe.dataset.testid = 'tweet-embed'
      iframe.loading = 'lazy'
      iframe.referrerPolicy = 'strict-origin-when-cross-origin'
      iframe.setAttribute('frameborder', '0')
      // Tweet.html reports its rendered height via postMessage; size to fit.
      listenForTweetHeight(iframe)
      return iframe
    },
  }
}

/** The `postMessage` payload the Twitter embed iframe sends once it has laid out. */
interface TweetResizeMessage {
  'twttr.embed'?: {
    method?: string
    params?: Array<{ height?: number }>
  }
}

/**
 * The Twitter embed iframe posts `{ 'twttr.embed': { method: 'twttr.private.resize',
 * params: [{ height }] } }` once it has laid out. Resize only for our own iframe.
 */
function listenForTweetHeight(iframe: HTMLIFrameElement): void {
  const onMessage = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow) return
    // REVIEW: 1. what if the message format change? Please add a try cache block here to avoid breaking the whole editor.
    // 2. if we do catch error, print a warning
    const message = event.data as TweetResizeMessage | null
    const height = message?.['twttr.embed']?.params?.[0]?.height
    if (typeof height === 'number') iframe.style.height = `${height}px`
  }
  window.addEventListener('message', onMessage)
  // Drop the listener once the iframe leaves the DOM (decoration rebuilt/removed).
  const observer = new MutationObserver(() => {
    if (!iframe.isConnected) {
      window.removeEventListener('message', onMessage)
      observer.disconnect()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
