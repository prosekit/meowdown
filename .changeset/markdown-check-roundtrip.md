---
'@meowdown/markdown': minor
'@meowdown/core': patch
---

Add `checkRoundTrip` to `@meowdown/markdown`, which classifies a parse-then-serialize round trip as `exact`, `normalizing`, or `lossy` without building a ProseMirror document. `@meowdown/core` re-exports it, so existing imports keep working.
