---
'@meowdown/core': patch
---

Indent and dedent list items in prosemirror-flat-list's strict mode. A list item is never more than one level deeper than the block before it, so Tab on the first item of a list does nothing instead of writing `+ [ ] + [ ] text`, and Shift-Tab moves a subtask and the following siblings up together. `editor.commands.indentList` and `dedentList` follow the same rule.
