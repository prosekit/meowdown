---
'@meowdown/core': minor
'@meowdown/react': minor
---

Add `refreshImages` (and `EditorHandle.refreshImages`) to re-resolve rendered images through `resolveImageUrl` without touching the document, and make `refreshMarkdownRendering` re-resolve images whose Markdown is unchanged.
