import '../testing/index.ts'

import dedent from 'dedent'
import { createRef } from 'react'
import { expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { MarkdownEditor } from '../components/editor.tsx'
import type { EditorHandle } from '../components/types.ts'
import { hover, unhover } from '../testing/mouse.ts'
import {
  createImageUrl,
  expectScreenshots,
  renderVisual,
  selectCells,
  selectText,
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
  Some text above the table.

  | Name | Kind | Price |
  | --- | --- | --- |
  | Apple | Fruit | 1.20 |
  | Carrot | Vegetable | 0.80 |
  | Rice | Grain | 2.50 |

  Some text below the table.
`

async function waitForImages(count: number) {
  const images = pmRoot.locate('img')
  await expect.poll(() => images.elements().length).toBe(count)
  const elements = images
    .elements()
    .filter((element): element is HTMLImageElement => element instanceof HTMLImageElement)
  await Promise.all(elements.map((image) => image.decode()))
}

interface Scenario {
  /**
   * The screenshot name.
   */
  name: string
  markdown: string
  /**
   * Waits for async content, or moves the editor into the state to capture.
   */
  prepare?: (handle: EditorHandle) => void | Promise<void>
}

/// keep-sorted { "keys": ["name"] }
const SCENARIOS: Scenario[] = [
  {
    name: 'code-block',
    markdown: dedent`
      \`\`\`ts
      export function greet(name: string): string {
        // Say hello
        return \`Hello, \${name}!\`
      }
      \`\`\`
    `,
    prepare: async () => {
      await expect
        .element(pmRoot.locate('pre code [class*="tok-"]').first(), { timeout: 15000 })
        .toBeInTheDocument()
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

      > A blockquote that is long enough to wrap onto a second line on a narrow screen.
    `,
  },
  {
    name: 'lists-mixed',
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
    name: 'lists',
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
    name: 'paragraph-image-only',
    markdown: '![landscape](landscape.svg)',
    prepare: () => waitForImages(1),
  },
  {
    name: 'paragraph-images',
    markdown: dedent`
      ![portrait](portrait.svg) ![square](square.svg)

      ![landscape](landscape.svg) ![portrait](portrait.svg) ![square](square.svg)
    `,
    prepare: () => waitForImages(5),
  },
  {
    name: 'paragraph-text-image',
    markdown: 'Text before the image ![landscape](landscape.svg) and text after it.',
    prepare: () => waitForImages(1),
  },
  {
    name: 'paragraph',
    markdown:
      'Meowdown is a hybrid live-preview Markdown editor. It keeps **bold**, *italic*, `code`, ~~strike~~, ==highlight==, [links](https://example.com) and [[wikilinks]] readable while you write.',
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
    name: 'table-select-all-cells',
    markdown: TABLE_MARKDOWN,
    prepare: (handle) => selectCells(handle, [0, 0], [3, 2]),
  },
  {
    name: 'table-select-block',
    markdown: TABLE_MARKDOWN,
    prepare: (handle) => selectCells(handle, [1, 1], [2, 2]),
  },
  {
    name: 'table-select-column',
    markdown: TABLE_MARKDOWN,
    prepare: (handle) => selectCells(handle, [0, 1], [3, 1]),
  },
  {
    name: 'table-select-node',
    markdown: TABLE_MARKDOWN,
    prepare: async () => {
      await hover(pmRoot.locate('table'))
      await page.getByTestId('block-handle-drag').click()
      await expect.element(pmRoot.locate('table.ProseMirror-selectednode')).toBeInTheDocument()
    },
  },
  {
    name: 'table-select-row',
    markdown: TABLE_MARKDOWN,
    prepare: (handle) => selectCells(handle, [2, 0], [2, 2]),
  },
  {
    name: 'table',
    markdown: dedent`
      | Name | Kind | Price |
      | :--- | :---: | ---: |
      | Apple | Fruit | 1.20 |
      | Carrot | Vegetable | 0.80 |
      | A long cell that wraps onto more lines | Other | 12.00 |
    `,
  },
  {
    name: 'task-lists',
    markdown: dedent`
      - [ ] Open task
      - [x] Done task
        - [ ] Nested open task
        - [x] Nested done task
      - [ ] A task that is long enough to wrap onto a second line on a narrow screen
    `,
  },
  {
    name: 'text-select-lists',
    markdown: dedent`
      - [ ] First task
      - [x] Second task
        - [ ] Nested task
      - Bullet item

      A paragraph after the list.
    `,
    prepare: (handle) => selectText(handle, 'task', 'after'),
  },
  {
    name: 'text-select-paragraph',
    markdown: 'Meowdown is a hybrid live-preview Markdown editor with **bold** and *italic* text.',
    prepare: (handle) => selectText(handle, 'live-preview', ' editor'),
  },
  {
    name: 'x-post',
    markdown: 'An X post:\n\n![](https://x.com/jack/status/20)',
    prepare: async () => {
      await expect
        .element(pmRoot.getByTestId('x-post-embed'))
        .toMatchTextContent('just setting up my twttr')
    },
  },
  {
    name: 'youtube',
    markdown: 'A YouTube video:\n\n![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)',
    prepare: async () => {
      await expect
        .element(pmRoot.getByTestId('youtube-video-embed'))
        .toMatchTextContent('Big Buck Bunny')
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
