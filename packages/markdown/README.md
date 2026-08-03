# @meowdown/markdown

The [`@lezer/markdown`](https://github.com/lezer-parser/markdown) grammar layer behind [`@meowdown/core`](https://www.npmjs.com/package/@meowdown/core): [GFM](https://github.github.com/gfm/) plus meowdown's inline syntax (wiki links, wiki embeds, hashtags, `==highlight==`, `$math$`, bare autolinks).

```sh
npm install @meowdown/markdown
```

```ts
import { gfmParser } from '@meowdown/markdown'

const tree = gfmParser.parse('Meeting with [[Ada Lovelace|Ada]]')
```

## Exports

- `gfmParser` / `gfmBlockOnlyParser`: the full and block-only Markdown parsers
- `parseInline` / `collectInlineElements`: low-level inline syntax parsing
- `getAutolinkHref`: bare-domain autolink matching against the TLD allowlist
- `LEZER_NODE_IDS`: the node id table shared with `@meowdown/core`
