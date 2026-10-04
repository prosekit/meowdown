# @meowdown/markdown

## 0.76.0

### Minor Changes

- [#668](https://github.com/prosekit/meowdown/pull/668) [`1202aa5`](https://github.com/prosekit/meowdown/commit/1202aa5c41c02e77f55f386b795810fe9f25f609) Thanks [@ocavuebot](https://github.com/ocavuebot)! - Add `isMarkdownAstEqual`, which compares two Markdown AST trees without their `position` fields.

- [#667](https://github.com/prosekit/meowdown/pull/667) [`7eb8d75`](https://github.com/prosekit/meowdown/commit/7eb8d75e0b9bf2c05a4c8ddb93eadcb24a8e95fc) Thanks [@ocavuebot](https://github.com/ocavuebot)! - `parseMarkdownAst` positions now index the text with `\n` line endings: a source with `\r\n` line endings is read as `\n` text, and the offsets are no longer mapped back onto the `\r\n` source.

## 0.75.0

### Minor Changes

- [#662](https://github.com/prosekit/meowdown/pull/662) [`0c695e7`](https://github.com/prosekit/meowdown/commit/0c695e7c45f776f924e406fa945a95516e833f1d) Thanks [@ocavuebot](https://github.com/ocavuebot)! - Every block, table row, and table cell returned by `parseMarkdownAst` now carries a `position` with `from` and `to` offsets into the source string.

## 0.74.0

### Minor Changes

- [#659](https://github.com/prosekit/meowdown/pull/659) [`775e240`](https://github.com/prosekit/meowdown/commit/775e2406c1000bff334b22fae25b9b156beaecc0) Thanks [@ocavuebot](https://github.com/ocavuebot)! - Move `checkRoundTrip` to `@meowdown/markdown`. `@meowdown/core` still re-exports it.

### Patch Changes

- [#658](https://github.com/prosekit/meowdown/pull/658) [`516f2d0`](https://github.com/prosekit/meowdown/commit/516f2d0ed22c26d5d686fc66bf8e3be39cd92221) Thanks [@ocavuebot](https://github.com/ocavuebot)! - A `MarkdownListItem` returned by `parseMarkdownAst` now always has at least one child: an item with nothing after its marker (`-` alone on a line) holds one empty paragraph, so `serializeMarkdownAst` writes the marker instead of dropping the line.

## 0.73.0

### Minor Changes

- [#644](https://github.com/prosekit/meowdown/pull/644) [`851fc06`](https://github.com/prosekit/meowdown/commit/851fc06f061061f8649142876a498f7de822300e) Thanks [@ocavuebot](https://github.com/ocavuebot)! - Add a standalone Markdown block AST parser and serializer shared with the editor.

## 0.72.0

### Minor Changes

- [#578](https://github.com/prosekit/meowdown/pull/578) [`f4b8bce`](https://github.com/prosekit/meowdown/commit/f4b8bcee3616b3a96c168e61546f09047f08d9c6) Thanks [@ocavue](https://github.com/ocavue)! - Add `collectImages` and `matchEmbed`.
