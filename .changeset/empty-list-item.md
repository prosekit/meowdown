---
'@meowdown/markdown': patch
---

Parse an empty list item (`-` alone on a line) as an item with one empty paragraph, so `serializeMarkdownAst` keeps the line instead of dropping it.
