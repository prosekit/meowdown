---
'@meowdown/core': patch
'@meowdown/react': patch
---

Report an error thrown by an editor plugin's `appendTransaction` or `decorations`, or by an `onDocChange` or pending replacement handler, with `reportError` instead of failing the transaction or the view update.
