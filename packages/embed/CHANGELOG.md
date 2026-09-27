# @meowdown/embed

## 0.3.1

### Patch Changes

- [#635](https://github.com/prosekit/meowdown/pull/635) [`7cee54a`](https://github.com/prosekit/meowdown/commit/7cee54a55320323d73ab6a73239f35a0118736d3) Thanks [@ocavuebot](https://github.com/ocavuebot)! - A long X post card no longer stretches its shrink-to-fit parent wider than the card.

## 0.3.0

### Minor Changes

- [#633](https://github.com/prosekit/meowdown/pull/633) [`7081039`](https://github.com/prosekit/meowdown/commit/708103975ce99b0b8980a9f96ef1d281dbd2e4e0) Thanks [@ocavuebot](https://github.com/ocavuebot)! - X post cards taller than `--meowdown-embed-max-height` (256px by default) are clipped behind a "Show more" toggle, in pure CSS; browsers without scroll-driven animations show the whole card.

## 0.2.0

### Minor Changes

- [#602](https://github.com/prosekit/meowdown/pull/602) [`c6fadae`](https://github.com/prosekit/meowdown/commit/c6fadaea4f982241f4e5e8201a442c1b6f4cffb3) Thanks [@ocavue](https://github.com/ocavue)! - Add `onYouTubeVideoClick`: the YouTube card dispatches a cancelable `meowdown-embed-youtube-click` event when its poster is clicked.

### Patch Changes

- [#601](https://github.com/prosekit/meowdown/pull/601) [`1182619`](https://github.com/prosekit/meowdown/commit/11826190926d4ffc9bfeb9fd9e90d572b75ad483) Thanks [@ocavue](https://github.com/ocavue)! - The unavailable X post card now links to the post.

## 0.1.0

### Minor Changes

- [#592](https://github.com/prosekit/meowdown/pull/592) [`1593f7c`](https://github.com/prosekit/meowdown/commit/1593f7c0e4f0d05dbbe43d7d5355169a02a30825) Thanks [@ocavue](https://github.com/ocavue)! - The X post card has a hairline border and roomier spacing again, and shows media as small uncropped thumbnails.

- [#591](https://github.com/prosekit/meowdown/pull/591) [`b4611e4`](https://github.com/prosekit/meowdown/commit/b4611e4262306632573ed9c809049e2aca17a782) Thanks [@ocavue](https://github.com/ocavue)! - Add `onXPostMediaClick` for photos and videos in X post cards; card videos now start from a poster button.

### Patch Changes

- [#593](https://github.com/prosekit/meowdown/pull/593) [`55f8809`](https://github.com/prosekit/meowdown/commit/55f880995b4d2076ba7ef64a1280f3455db98547) Thanks [@ocavue](https://github.com/ocavue)! - A quoted X post no longer spends its three lines on blank lines.
