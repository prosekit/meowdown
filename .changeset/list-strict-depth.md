---
'@meowdown/core': patch
---

Tab on the first item of a list no longer writes `+ [ ] + [ ] text` because list commands now run in prosemirror-flat-list's strict mode.
