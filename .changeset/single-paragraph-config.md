---
'@meowdown/core': minor
'@meowdown/react': minor
---

Single-paragraph editing is now the `singleParagraph` editor config option: block input rules and enter rules stay quiet while it is set, so typed `# `, `> `, `- ` and fences stay literal while the `[[` and `#` menus and substitutions keep working. `defineSingleParagraph` is no longer exported from `@meowdown/core`; `MarkdownEditor`'s `singleParagraph` prop sets the option.
