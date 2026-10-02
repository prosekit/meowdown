---
'@meowdown/markdown': patch
---

A `MarkdownListItem` returned by `parseMarkdownAst` now always has at least one child: an item with nothing after its marker (`-` alone on a line) holds one empty paragraph, so `serializeMarkdownAst` writes the marker instead of dropping the line.
