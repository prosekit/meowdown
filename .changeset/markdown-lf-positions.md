---
'@meowdown/markdown': minor
---

`parseMarkdownAst` positions now index the text with `\n` line endings: a source with `\r\n` line endings is read as `\n` text, and the offsets are no longer mapped back onto the `\r\n` source.
