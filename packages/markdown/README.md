# @meowdown/markdown

The [`@lezer/markdown`](https://github.com/lezer-parser/markdown) grammar layer behind [`@meowdown/core`](https://www.npmjs.com/package/@meowdown/core): GFM plus meowdown's inline syntax (wiki links, wiki embeds, hashtags, `==highlight==`, `$math$`, bare autolinks).

```sh
npm install @meowdown/markdown
```

```ts
import { gfmParser } from '@meowdown/markdown'

const tree = gfmParser.parse('Meeting with [[Ada Lovelace|Ada]]')
```
