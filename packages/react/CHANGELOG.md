# @meowdown/react

## 0.73.0

### Minor Changes

- [#604](https://github.com/prosekit/meowdown/pull/604) [`ca745ea`](https://github.com/prosekit/meowdown/commit/ca745ea350d346e968a973afc3e698cb8acc7705) Thanks [@ocavue](https://github.com/ocavue)! - Add `LightboxFrame` and the `frame` lightbox item, which shows an embedded player such as a YouTube video at its aspect ratio.

- [#602](https://github.com/prosekit/meowdown/pull/602) [`c6fadae`](https://github.com/prosekit/meowdown/commit/c6fadaea4f982241f4e5e8201a442c1b6f4cffb3) Thanks [@ocavue](https://github.com/ocavue)! - Add `onYouTubeVideoClick`: the YouTube card dispatches a cancelable `meowdown-embed-youtube-click` event when its poster is clicked.

### Patch Changes

- Updated dependencies [[`1182619`](https://github.com/prosekit/meowdown/commit/11826190926d4ffc9bfeb9fd9e90d572b75ad483), [`c6fadae`](https://github.com/prosekit/meowdown/commit/c6fadaea4f982241f4e5e8201a442c1b6f4cffb3)]:
  - @meowdown/embed@0.2.0
  - @meowdown/core@0.74.0

## 0.72.0

### Minor Changes

- [#594](https://github.com/prosekit/meowdown/pull/594) [`83c4b36`](https://github.com/prosekit/meowdown/commit/83c4b360850c1c657255d6b496967ceb994a5308) Thanks [@ocavue](https://github.com/ocavue)! - Add `LightboxRoot`, `LightboxImage`, `LightboxVideo`, and `useLightbox` (requires React 19.3), and pass the clicked `<img>` to `onImageClick` as `element`.

- [#591](https://github.com/prosekit/meowdown/pull/591) [`b4611e4`](https://github.com/prosekit/meowdown/commit/b4611e4262306632573ed9c809049e2aca17a782) Thanks [@ocavue](https://github.com/ocavue)! - Add `onXPostMediaClick` for photos and videos in X post cards; card videos now start from a poster button.

### Patch Changes

- [#590](https://github.com/prosekit/meowdown/pull/590) [`42a1c14`](https://github.com/prosekit/meowdown/commit/42a1c14676a85b5765525e9356a700161abfccb9) Thanks [@ocavue](https://github.com/ocavue)! - Render X post and YouTube video cards with `@meowdown/embed`: the elements are now `<meowdown-embed-x>` and `<meowdown-embed-youtube>`, themed by `--meowdown-embed-*` variables.

- [#588](https://github.com/prosekit/meowdown/pull/588) [`3d36899`](https://github.com/prosekit/meowdown/commit/3d368999ad0226b69be230591accc65c5072b62f) Thanks [@ocavue](https://github.com/ocavue)! - Update `@post-embed/elements` to 0.6.0: X post cards are smaller and shrink with a narrow editor.
- Updated dependencies [[`1593f7c`](https://github.com/prosekit/meowdown/commit/1593f7c0e4f0d05dbbe43d7d5355169a02a30825), [`83c4b36`](https://github.com/prosekit/meowdown/commit/83c4b360850c1c657255d6b496967ceb994a5308), [`42a1c14`](https://github.com/prosekit/meowdown/commit/42a1c14676a85b5765525e9356a700161abfccb9), [`55f8809`](https://github.com/prosekit/meowdown/commit/55f880995b4d2076ba7ef64a1280f3455db98547), [`3d36899`](https://github.com/prosekit/meowdown/commit/3d368999ad0226b69be230591accc65c5072b62f), [`b4611e4`](https://github.com/prosekit/meowdown/commit/b4611e4262306632573ed9c809049e2aca17a782)]:
  - @meowdown/embed@0.1.0
  - @meowdown/core@0.73.0

## 0.71.4

### Patch Changes

- Updated dependencies [[`007dc5c`](https://github.com/prosekit/meowdown/commit/007dc5c73bd16a59ed51de0a6664bffcb46b215c), [`35d1807`](https://github.com/prosekit/meowdown/commit/35d1807e89e68a623b896e0b6ffea50633020136)]:
  - @meowdown/core@0.72.1

## 0.71.3

### Patch Changes

- [#578](https://github.com/prosekit/meowdown/pull/578) [`f4b8bce`](https://github.com/prosekit/meowdown/commit/f4b8bcee3616b3a96c168e61546f09047f08d9c6) Thanks [@ocavue](https://github.com/ocavue)! - Move `matchPostEmbed`, `parseXPostId`, and `PostEmbedKind` from `@meowdown/core` to `@meowdown/markdown` as `matchEmbed`, `parseXPostId`, and `EmbedKind`.
- Updated dependencies [[`f4b8bce`](https://github.com/prosekit/meowdown/commit/f4b8bcee3616b3a96c168e61546f09047f08d9c6), [`f4b8bce`](https://github.com/prosekit/meowdown/commit/f4b8bcee3616b3a96c168e61546f09047f08d9c6)]:
  - @meowdown/markdown@0.72.0
  - @meowdown/core@0.72.0
