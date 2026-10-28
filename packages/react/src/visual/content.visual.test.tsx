import '../testing/index.ts'

import dedent from 'dedent'
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { MarkdownEditor } from '../components/editor.tsx'
import { createImageUrl, expectScreenshots, renderVisual } from '../testing/visual.tsx'

const pmRoot = page.locate('.ProseMirror')

const IMAGE_URLS: Record<string, string> = {
  'landscape.svg': createImageUrl(480, 270, '#4f86c6'),
  'portrait.svg': createImageUrl(180, 260, '#c66f4f'),
  'square.svg': createImageUrl(160, 160, '#5aa469'),
}

function resolveImageUrl(src: string): string {
  return IMAGE_URLS[src] ?? src
}

async function setupContent(markdown: string) {
  await renderVisual(
    <MarkdownEditor initialMarkdown={markdown} resolveImageUrl={resolveImageUrl} />,
  )
  await expect.element(pmRoot).toBeVisible()
}

async function waitForImages(count: number) {
  const images = pmRoot.locate('img')
  await expect.poll(() => images.elements().length).toBe(count)
  const elements = images
    .elements()
    .filter((element): element is HTMLImageElement => element instanceof HTMLImageElement)
  await Promise.all(elements.map((image) => image.decode()))
}

describe('content', () => {
  it('renders a paragraph', async () => {
    await setupContent(
      'Meowdown is a hybrid live-preview Markdown editor. It keeps **bold**, *italic*, `code`, ~~strike~~, ==highlight==, [links](https://example.com) and [[wikilinks]] readable while you write.',
    )
    await expectScreenshots('paragraph')
  })

  it('renders headings and a blockquote', async () => {
    await setupContent(dedent`
      # Heading 1

      ## Heading 2

      ### Heading 3

      > A blockquote that is long enough to wrap onto a second line on a narrow screen.
    `)
    await expectScreenshots('headings')
  })

  it('renders a paragraph with text and an image', async () => {
    await setupContent('Text before the image ![landscape](landscape.svg) and text after it.')
    await waitForImages(1)
    await expectScreenshots('paragraph-text-image')
  })

  it('renders a paragraph with only an image', async () => {
    await setupContent('![landscape](landscape.svg)')
    await waitForImages(1)
    await expectScreenshots('paragraph-image-only')
  })

  it('renders a paragraph with several images', async () => {
    await setupContent(dedent`
      ![portrait](portrait.svg) ![square](square.svg)

      ![landscape](landscape.svg) ![portrait](portrait.svg) ![square](square.svg)
    `)
    await waitForImages(5)
    await expectScreenshots('paragraph-images')
  })

  it('renders a table', async () => {
    await setupContent(dedent`
      | Name | Kind | Price |
      | :--- | :---: | ---: |
      | Apple | Fruit | 1.20 |
      | Carrot | Vegetable | 0.80 |
      | A long cell that wraps onto more lines | Other | 12.00 |
    `)
    await expectScreenshots('table')
  })

  it('renders a code block', async () => {
    await setupContent(dedent`
      \`\`\`ts
      export function greet(name: string): string {
        // Say hello
        return \`Hello, \${name}!\`
      }
      \`\`\`
    `)
    await expect
      .element(pmRoot.locate('pre code [class*="tok-"]').first(), { timeout: 15000 })
      .toBeInTheDocument()
    await expectScreenshots('code-block')
  })

  it('renders bullet and ordered lists', async () => {
    await setupContent(dedent`
      - Bullet item
      - A bullet item that is long enough to wrap onto a second line on a narrow screen
        - Nested bullet
          - Deeper bullet

      1. First
      2. Second
         1. Nested ordered
         2. Another nested ordered
      3. Third
    `)
    await expectScreenshots('lists')
  })

  it('renders task lists', async () => {
    await setupContent(dedent`
      - [ ] Open task
      - [x] Done task
        - [ ] Nested open task
        - [x] Nested done task
      - [ ] A task that is long enough to wrap onto a second line on a narrow screen
    `)
    await expectScreenshots('task-lists')
  })

  it('renders mixed nested lists', async () => {
    await setupContent(dedent`
      - Bullet
        1. Ordered inside a bullet
           - [ ] Task inside an ordered item
        2. Second ordered

          A paragraph inside a list item.
      - Bullet with a code block

        \`\`\`
        plain code
        \`\`\`
    `)
    await expectScreenshots('lists-mixed')
  })
})
