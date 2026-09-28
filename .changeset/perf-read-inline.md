---
'@meowdown/core': patch
---

Serialize the editor document faster: the Markdown adapter computes a textblock's text content only when the block holds an inline atom.
