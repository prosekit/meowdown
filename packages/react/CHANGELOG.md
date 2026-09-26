# @meowdown/react

## 0.75.0

### Minor Changes

- [#628](https://github.com/prosekit/meowdown/pull/628) [`b09d2b2`](https://github.com/prosekit/meowdown/commit/b09d2b28495e00dc4a05e2eeda4927dddbf09cf0) Thanks [@ocavuebot](https://github.com/ocavuebot)! - `resolveImageUrl` may return a `Promise<string | undefined>`. The image appears once it resolves; while it is pending, an image with a persisted `width` and `height` reserves a box of that size so the resolved image does not shift the layout. This applies to the editor and to `MarkdownView`.

### Patch Changes

- Updated dependencies [[`b09d2b2`](https://github.com/prosekit/meowdown/commit/b09d2b28495e00dc4a05e2eeda4927dddbf09cf0)]:
  - @meowdown/core@0.75.0

## 0.74.0

### Minor Changes

- [#624](https://github.com/prosekit/meowdown/pull/624) [`39f6f3c`](https://github.com/prosekit/meowdown/commit/39f6f3c7f2badf093610e140f20c998bac6a1236) Thanks [@ocavuebot](https://github.com/ocavuebot)! - Rename `EditorHandle.editor` to `getEditor()`.

### Patch Changes

- [#617](https://github.com/prosekit/meowdown/pull/617) [`6fefe3d`](https://github.com/prosekit/meowdown/commit/6fefe3d867971c824d4844f795bdeddf9dd4564e) Thanks [@ocavuebot](https://github.com/ocavuebot)! - Keep the link preview closed after the link editor or preview is dismissed, until the pointer leaves the link.

- [#614](https://github.com/prosekit/meowdown/pull/614) [`f8b093f`](https://github.com/prosekit/meowdown/commit/f8b093fd4b04cab2284fd6b174e044d2aed57ab6) Thanks [@ocavuebot](https://github.com/ocavuebot)! - Key wikilink and tag menu rows by `target` and `tag`, so rows with the same visible text highlight and select independently.
- Updated dependencies [[`ac3268d`](https://github.com/prosekit/meowdown/commit/ac3268d4999637fe67d91cd3b37757ac960755ec), [`6fefe3d`](https://github.com/prosekit/meowdown/commit/6fefe3d867971c824d4844f795bdeddf9dd4564e), [`84d0577`](https://github.com/prosekit/meowdown/commit/84d05779109e9dce9bc15ac2c1a8b2f4c1386415)]:
  - @meowdown/core@0.74.2

## 0.73.1

### Patch Changes

- Updated dependencies [[`e6b58eb`](https://github.com/prosekit/meowdown/commit/e6b58eb348b8c90e3b7bd02550717681f5e1f171)]:
  - @meowdown/core@0.74.1

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
