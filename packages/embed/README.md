# @meowdown/embed

Web components for rendering saved X posts and YouTube videos, used by [`@meowdown/core`](https://www.npmjs.com/package/@meowdown/core).

```sh
npm install @meowdown/embed
```

```ts
import '@meowdown/embed/x/theme.css'

import { registerXPost } from '@meowdown/embed/x'
import type { XPost } from '@post-embed/types'

export function showPost(container: HTMLElement, post: XPost) {
  registerXPost()
  const element = document.createElement('meowdown-embed-x')
  element.data = post
  container.append(element)
  return element
}
```

`XPost` is a small snapshot with only what the card renders: the author, the body split into text and link segments, media, an optional quote and reply target, the edit state. Assign a new `XPost` object to `element.data` to update the post, or `null` to clear it. The theme import is optional.

`@post-embed/exporter` produces `XPost` values: `fromSyndication` from the syndication API data X's own embeds use, `observeXTweets` from the GraphQL responses of the x.com page.

## Loading a snapshot by URL

Set `element.url` and `element.resolver` to let the element load its own snapshot. The element calls `resolver(url)` whenever `data` is `null` and both are set, and renders whatever it returns (a snapshot, a promise of one, or `undefined` when nothing was found). Results from a superseded `url` are dropped. While a promise is pending the fallback card carries a `data-pending` attribute. A saved `data` always wins over the fetched snapshot.

```ts
import { fromSyndication } from '@post-embed/exporter/x/syndication'

const element = document.createElement('meowdown-embed-x')
element.resolver = async (url) => {
  const id = new URL(url).pathname.split('/').at(-1)
  const response = await fetch(`/api/tweet/${id}`)
  if (!response.ok) return
  const result = fromSyndication(await response.json())
  if (result.issues) throw new Error('Invalid post data')
  return result.value
}
element.url = 'https://x.com/jack/status/20'
```

The syndication API X's own embeds read from does not allow cross-origin requests, so `resolver` for X posts usually goes through your server.

## YouTube video

```ts
import '@meowdown/embed/youtube/theme.css'

import { registerYouTubeVideo } from '@meowdown/embed/youtube'
import type { YouTubeVideo } from '@post-embed/types'

export function showVideo(container: HTMLElement, url: string) {
  registerYouTubeVideo()
  const element = document.createElement('meowdown-embed-youtube')
  element.resolver = async (url) => {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    )
    if (!response.ok) return
    return { url, ...(await response.json()) } as YouTubeVideo
  }
  element.url = url
  container.append(element)
  return element
}
```

The snapshot is the YouTube oEmbed response plus the video `url`; YouTube's oEmbed endpoint allows cross-origin requests, so `resolver` can call it directly, or assign a saved snapshot to `element.data` instead. The element renders a card with the poster, title, channel, and a "Watch on YouTube" link, and never creates an iframe unless you set `playback="inline"` (as an attribute or `element.playback = 'inline'`). In inline mode the poster becomes a play button, and clicking it swaps in the `youtube-nocookie.com` player. The poster loads from the saved `thumbnail_url`; point it at your own copy if the page must not contact Google's image CDN.

## X video delivery

X's video CDN can reject requests carrying a third-party page referrer even when the poster loads. Hosts using remote X media should set `Referrer-Policy: no-referrer` on the embedding document, or place `<meta name="referrer" content="no-referrer">` early in its head. This affects all requests from that document; the component never changes the policy itself.

`crossorigin="anonymous"` and the poster image's `referrerpolicy` do not suppress a native video's referrer. If the host needs to retain its document policy, return archived/local media URLs from its resolver or serve media through a host-controlled endpoint that omits the upstream referrer and supports byte ranges. A host handling `meowdown-embed-media-click` owns delivery and playback in its player.

Terminal media failures log one `[meowdown]` warning per media item, with the post and source locations (without query strings or fragments). Native media errors do not expose HTTP status; inspect network requests to distinguish HTTP rejection from decoding failures. An unsuccessful source can fall back to another source without a terminal warning.
