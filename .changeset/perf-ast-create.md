---
'@meowdown/core': patch
---

Parse Markdown into a document faster: nodes are created directly from the schema instead of through the typed builders. `markdownToDoc` accepts a `schema` option; `nodes` still works.
