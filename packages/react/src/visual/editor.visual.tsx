import '../testing/index.ts'

import dedent from 'dedent'
import { createRef } from 'react'
import { expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { MarkdownEditor } from '../components/editor.tsx'
import type { EditorHandle } from '../components/types.ts'
import { unhover } from '../testing/mouse.ts'
import {
  createImageUrl,
  expectScreenshots,
  renderVisual,
  selectBlock,
  selectCells,
  selectText,
  selectTextMatch,
} from '../testing/visual.tsx'
import { createXPost } from '../testing/x-post-fixture.ts'
import { createYouTubeVideo } from '../testing/youtube-fixture.ts'

const pmRoot = page.locate('.ProseMirror')

const IMAGE_URLS: Record<string, string> = {
  'landscape.svg': createImageUrl(480, 270, '#4f86c6'),
  'portrait.svg': createImageUrl(180, 260, '#c66f4f'),
  'square.svg': createImageUrl(160, 160, '#5aa469'),
}

function resolveImageUrl(src: string): string {
  return IMAGE_URLS[src] ?? src
}

const TABLE_MARKDOWN = dedent`
  | Name | Kind | Price |
  | :--- | :---: | ---: |
  | Apple | Fruit | 1.20 |
  | Carrot | Vegetable | 0.80 |
  | A long cell that wraps onto more lines | Other | 12.00 |
`

const PARAGRAPH_MARKDOWN =
  'Meowdown is a hybrid live-preview Markdown editor. It keeps **bold**, *italic*, `code`, ~~strike~~, ==highlight==, [links](https://example.com) and [[wikilinks]] readable while you write.'

const BLOCKQUOTE_MARKDOWN =
  '> A blockquote that is long enough to wrap onto a second line on a narrow screen.'

const CODE_BLOCK_MARKDOWN = dedent`
  \`\`\`ts
  function greet(name: string): string | undefined | null | Promise<string> | Promise<undefined> | Promise<null> {
    return \`Hello, \${name}!\`
  }
  \`\`\`
`

const X_POST_MARKDOWN = '![](https://x.com/jack/status/20)'

const YOUTUBE_MARKDOWN = '![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)'

const TEXT_IMAGE_MARKDOWN = 'Text before the image ![landscape](landscape.svg) and text after it.'

const IMAGE_ONLY_MARKDOWN = '![landscape](landscape.svg)'

async function waitForImages(count: number) {
  const images = pmRoot.locate('img')
  await expect.poll(() => images.elements().length).toBe(count)
  const elements = images
    .elements()
    .filter((element): element is HTMLImageElement => element instanceof HTMLImageElement)
  await Promise.all(elements.map((image) => image.decode()))
}

async function waitForCodeTokens() {
  await expect
    .element(pmRoot.locate('pre code [class*="tok-"]').first(), { timeout: 15000 })
    .toBeInTheDocument()
}

async function waitForXPost() {
  await expect
    .element(pmRoot.getByTestId('x-post-embed'))
    .toMatchTextContent('just setting up my twttr')
}

async function waitForYouTube() {
  await expect
    .element(pmRoot.getByTestId('youtube-video-embed'))
    .toMatchTextContent('Big Buck Bunny')
}

/**
 * Selects the whole landscape image source, which rings its preview.
 */
async function selectImage(handle: EditorHandle) {
  await waitForImages(1)
  selectTextMatch(handle, '![landscape](landscape.svg)')
}

interface Scenario {
  name: string
  markdown: string
  prepare?: (handle: EditorHandle) => void | Promise<void>
}

// Names are `<subject>` or `<subject>-<state>`, so keep-sorted puts every state
// of one subject together.
/// keep-sorted { "keys": ["name"] }
const SCENARIOS: Scenario[] = [
  {
    name: 'blockquote-node-selected',
    markdown: BLOCKQUOTE_MARKDOWN,
    prepare: async (handle) => {
      await selectBlock(handle, [0])
    },
  },
  {
    name: 'blockquote',
    markdown: BLOCKQUOTE_MARKDOWN,
  },
  {
    name: 'code-block-node-selected',
    markdown: CODE_BLOCK_MARKDOWN,
    prepare: async (handle) => {
      await waitForCodeTokens()
      await selectBlock(handle, [0])
    },
  },
  {
    name: 'code-block',
    markdown: CODE_BLOCK_MARKDOWN,
    prepare: async () => {
      await waitForCodeTokens()
    },
  },
  {
    name: 'heading-node-selected-between',
    markdown: dedent`
      Some text above.

      ## A selected heading

      Some text below.
    `,
    prepare: async (handle) => {
      await selectBlock(handle, [1])
    },
  },
  {
    name: 'heading-node-selected',
    markdown: '## A selected heading',
    prepare: async (handle) => {
      await selectBlock(handle, [0])
    },
  },
  {
    name: 'headings',
    markdown: dedent`
      # Heading 1

      ## Heading 2

      ### Heading 3

      #### Heading 4

      ##### Heading 5

      ###### Heading 6
    `,
  },
  {
    name: 'horizontal-rule-node-selected',
    markdown: '---',
    prepare: async (handle) => {
      await selectBlock(handle, [0])
    },
  },
  {
    name: 'image-in-text-image-selected',
    markdown: TEXT_IMAGE_MARKDOWN,
    prepare: async (handle) => {
      await selectImage(handle)
    },
  },
  {
    name: 'image-in-text-node-selected',
    markdown: TEXT_IMAGE_MARKDOWN,
    prepare: async (handle) => {
      await waitForImages(1)
      await selectBlock(handle, [0])
    },
  },
  {
    name: 'image-in-text',
    markdown: TEXT_IMAGE_MARKDOWN,
    prepare: async () => {
      await waitForImages(1)
    },
  },
  {
    name: 'image-only-image-selected',
    markdown: IMAGE_ONLY_MARKDOWN,
    prepare: async (handle) => {
      await selectImage(handle)
    },
  },
  {
    name: 'image-only-node-selected',
    markdown: IMAGE_ONLY_MARKDOWN,
    prepare: async (handle) => {
      await waitForImages(1)
      await selectBlock(handle, [0])
    },
  },
  {
    name: 'image-only',
    markdown: IMAGE_ONLY_MARKDOWN,
    prepare: async () => {
      await waitForImages(1)
    },
  },
  {
    name: 'images',
    markdown: dedent`
      ![portrait](portrait.svg) ![square](square.svg)

      ![landscape](landscape.svg) ![portrait](portrait.svg) ![square](square.svg)
    `,
    prepare: async () => {
      await waitForImages(5)
    },
  },
  {
    name: 'list-item-node-selected',
    markdown: dedent`
      - First item
      - Second item
      - Third item
    `,
    prepare: async (handle) => {
      await selectBlock(handle, [1])
    },
  },
  {
    name: 'list-mixed',
    markdown: dedent`
      - Bullet
        1. Ordered inside a bullet
           - [ ] Task inside an ordered item
        2. Second ordered

          A paragraph inside a list item.
      - Bullet with a code block

        \`\`\`
        plain code
        \`\`\`
    `,
  },
  {
    name: 'list-nested-item-node-selected',
    markdown: dedent`
      - First item
      - Second item
        - Nested item
        - Another nested item
      - Third item
    `,
    prepare: async (handle) => {
      await selectBlock(handle, [1, 1])
    },
  },
  {
    name: 'list-text-selected',
    markdown: dedent`
      - [ ] First task
      - [x] Second task
        - [ ] Nested task
      - Bullet item

      A paragraph after the list.
    `,
    prepare: (handle) => {
      selectText(handle, 'task', 'after')
    },
  },
  {
    name: 'list',
    markdown: dedent`
      - Bullet item
      - A bullet item that is long enough to wrap onto a second line on a narrow screen
        - Nested bullet
          - Deeper bullet

      1. First
      2. Second
         1. Nested ordered
         2. Another nested ordered
      3. Third
    `,
  },
  {
    name: 'math-node-selected',
    markdown: dedent`
      \`\`\`math
      E = mc^2
      \`\`\`
    `,
    prepare: async (handle) => {
      const preview = pmRoot.getByTestId('code-block-math-preview')
      await expect.element(preview.locate('.katex')).toBeInTheDocument()
      await selectBlock(handle, [0])
    },
  },
  {
    name: 'paragraph-node-selected',
    markdown: PARAGRAPH_MARKDOWN,
    prepare: async (handle) => {
      await selectBlock(handle, [0])
    },
  },
  {
    name: 'paragraph-text-selected',
    markdown: 'Meowdown is a hybrid live-preview Markdown editor with **bold** and *italic* text.',
    prepare: (handle) => {
      selectText(handle, 'live-preview', ' editor')
    },
  },
  {
    name: 'paragraph',
    markdown: PARAGRAPH_MARKDOWN,
  },
  {
    name: 'slash-menu',
    markdown: 'Type a slash below.\n\n',
    prepare: async () => {
      await pmRoot.locate('p').last().click()
      await userEvent.keyboard('/')
      await expect.element(page.getByTestId('slash-menu')).toBeVisible()
    },
  },
  {
    name: 'table-cells-all-selected',
    markdown: `select all cells\n\n${TABLE_MARKDOWN}`,
    prepare: async (handle) => {
      await selectCells(handle, [0, 0], [3, 2])
    },
  },
  {
    name: 'table-cells-block-selected',
    markdown: `select table block\n\n${TABLE_MARKDOWN}`,
    prepare: async (handle) => {
      await selectCells(handle, [1, 1], [2, 2])
    },
  },
  {
    name: 'table-cells-column-selected',
    markdown: `select table column\n\n${TABLE_MARKDOWN}`,
    prepare: async (handle) => {
      await selectCells(handle, [0, 1], [3, 1])
    },
  },
  {
    name: 'table-cells-row-selected',
    markdown: `select table row\n\n${TABLE_MARKDOWN}`,
    prepare: async (handle) => {
      await selectCells(handle, [2, 0], [2, 2])
    },
  },
  {
    name: 'table-node-selected',
    markdown: `select table node\n\n${TABLE_MARKDOWN}`,
    prepare: async (handle) => {
      await selectBlock(handle, [1])
    },
  },
  {
    name: 'table',
    markdown: TABLE_MARKDOWN,
  },
  {
    name: 'task-list-item-node-selected',
    markdown: dedent`
      - [ ] First task
      - [x] Second task
      - [ ] Third task
    `,
    prepare: async (handle) => {
      await selectBlock(handle, [1])
    },
  },
  {
    name: 'task-list',
    markdown: dedent`
      - [ ] Open task
      - [x] Done task
        - [ ] Nested open task
        - [x] Nested done task
      - [ ] A task that is long enough to wrap onto a second line on a narrow screen
    `,
  },
  {
    name: 'x-post-node-selected',
    markdown: X_POST_MARKDOWN,
    prepare: async (handle) => {
      await waitForXPost()
      await selectBlock(handle, [0])
    },
  },
  {
    name: 'x-post',
    markdown: dedent`
      An X post:

      ${X_POST_MARKDOWN}
    `,
    prepare: async () => {
      await waitForXPost()
    },
  },
  {
    name: 'youtube-node-selected',
    markdown: YOUTUBE_MARKDOWN,
    prepare: async (handle) => {
      await waitForYouTube()
      await selectBlock(handle, [0])
    },
  },
  {
    name: 'youtube',
    markdown: dedent`
      A YouTube video:

      ${YOUTUBE_MARKDOWN}
    `,
    prepare: async () => {
      await waitForYouTube()
    },
  },
]

for (const scenario of SCENARIOS) {
  it(scenario.name, async () => {
    await unhover()
    const ref = createRef<EditorHandle>()
    await renderVisual(
      <MarkdownEditor
        handleRef={ref}
        initialMarkdown={scenario.markdown}
        resolveImageUrl={resolveImageUrl}
        resolveXPost={() => createXPost()}
        resolveYouTubeVideo={() => createYouTubeVideo()}
      />,
    )
    await expect.element(pmRoot).toBeVisible()
    const handle = ref.current
    if (!handle) throw new Error('editor not mounted')
    await scenario.prepare?.(handle)
    await expectScreenshots(scenario.name)
  })
}
