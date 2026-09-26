---
'@meowdown/core': minor
'@meowdown/react': minor
---

`resolveImageUrl` may return a `Promise<string | undefined>`. The image appears once it resolves; while it is pending, an image with a persisted `width` and `height` reserves a box of that size so the resolved image does not shift the layout. This applies to the editor and to `MarkdownView`.
