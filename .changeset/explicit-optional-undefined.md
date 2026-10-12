---
'@meowdown/core': patch
'@meowdown/markdown': patch
'@meowdown/react': patch
---

Optional properties in public types now accept an explicit `undefined`, so they work under [`exactOptionalPropertyTypes`](https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes).
