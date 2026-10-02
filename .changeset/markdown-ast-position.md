---
'@meowdown/markdown': minor
---

Every block, table row, and table cell returned by `parseMarkdownAst` now carries a `position` with `from` and `to` offsets into the source string.
