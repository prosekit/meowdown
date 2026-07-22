import '../testing/index.ts'

import { readClipboard } from '@meowdown/vitest/clipboard'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

const selector = page.getByTestId('code-block-language')
const search = page.getByTestId('code-block-language-search')
const copyButton = page.getByTestId('code-block-copy')
const tokens = page.locate('.ProseMirror pre code [class*="tok-"]')

const CODE_BLOCK_MD = '```rust\nfn main() {}\n```'

describe('code block language selector', () => {
  it('shows the current language for a code block', async () => {
    await render(<ProseKitEditor initialMarkdown={CODE_BLOCK_MD} />)
    await expect.element(selector).toBeInTheDocument()
    await expect.element(selector).toHaveTextContent('Rust')
  })

  it('highlights the code block with syntax tokens', async () => {
    await render(<ProseKitEditor initialMarkdown={CODE_BLOCK_MD} />)
    await expect.element(tokens.first(), { timeout: 15000 }).toBeInTheDocument()
  })

  it('changes the language and round-trips it to markdown', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} initialMarkdown={CODE_BLOCK_MD} />)
    await expect.element(selector).toHaveTextContent('Rust')

    await selector.click()
    await page.getByRole('option', { name: 'Python', exact: true }).click()

    await expect.element(selector).toHaveTextContent('Python')
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('```python')
    })
  })

  it('filters the languages as the user types', async () => {
    await render(<ProseKitEditor initialMarkdown={CODE_BLOCK_MD} />)

    await selector.click()
    await search.fill('python')

    await expect
      .element(page.getByRole('option', { name: 'Python', exact: true }))
      .toBeInTheDocument()
    await expect
      .element(page.getByRole('option', { name: 'Rust', exact: true }))
      .not.toBeInTheDocument()
  })

  it('lets the user set a language outside the list', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} initialMarkdown={CODE_BLOCK_MD} />)

    await selector.click()
    await search.fill('mylang')
    await page.getByRole('option', { name: 'Use "mylang"', exact: true }).click()

    await expect.element(selector).toHaveTextContent('mylang')
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('```mylang')
    })
  })

  it('copies the code block contents to the clipboard', async () => {
    await render(<ProseKitEditor initialMarkdown={CODE_BLOCK_MD} />)
    await expect.element(copyButton).toBeInTheDocument()

    await copyButton.click()

    await expect.element(copyButton).toHaveAttribute('data-copied')

    expect((await readClipboard()).text).toBe('fn main() {}')
  })
})

const mathPreview = page.getByTestId('code-block-math-preview')
const mathSource = page.locate('.ProseMirror pre[data-language="math"]')

// The leading paragraph keeps the initial caret outside the math block; a
// document holding only the block would start with the caret inside it.
const MATH_BLOCK_MD = 'before\n\n$$\nE=mc^2\n$$'

describe('code block math preview', () => {
  it('shows only the rendered formula when the caret is outside', async () => {
    await render(<ProseKitEditor initialMarkdown={MATH_BLOCK_MD} />)
    await expect.element(mathPreview.locate('.katex')).toBeInTheDocument()
    await expect.element(mathPreview).toBeVisible()
    await expect.element(mathSource).not.toBeVisible()
  })

  it('shows the source above the preview once the caret enters', async () => {
    await render(<ProseKitEditor initialMarkdown={MATH_BLOCK_MD} />)
    await expect.element(mathPreview).toBeVisible()

    await mathPreview.click()

    await expect.element(mathSource).toBeVisible()
    await expect.element(mathPreview).toBeVisible()
    const source = mathSource.element()
    const preview = mathPreview.element()
    const position = source.compareDocumentPosition(preview)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('updates the preview live while typing', async () => {
    await render(<ProseKitEditor initialMarkdown={'before\n\n$$\nE=m\n$$'} />)
    await mathPreview.click()
    await expect.element(mathSource).toBeVisible()

    await userEvent.keyboard('c')

    await expect.element(mathPreview).toHaveTextContent(/cE=m/)
  })

  it('renders a math fence with the same preview', async () => {
    await render(<ProseKitEditor initialMarkdown={'```math\nE=mc^2\n```'} />)
    await expect.element(mathPreview.locate('.katex')).toBeInTheDocument()
  })

  it('shows no preview for other languages', async () => {
    await render(<ProseKitEditor initialMarkdown={CODE_BLOCK_MD} />)
    await expect.element(page.locate('.ProseMirror pre[data-language="rust"]')).toBeVisible()
    await expect.element(mathPreview).not.toBeInTheDocument()
  })

  it('renders an error for invalid TeX without hiding the block', async () => {
    await render(<ProseKitEditor initialMarkdown={'$$\n\\frac{\n$$'} />)
    await expect.element(mathPreview.locate('.katex-error')).toBeInTheDocument()
  })

  it('keeps the source visible for an empty math block', async () => {
    await render(<ProseKitEditor initialMarkdown={'before\n\n$$\n$$'} />)
    await expect.element(mathSource).toBeVisible()
  })

  it('drops the preview and falls back to a backtick fence when the language changes', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} initialMarkdown={MATH_BLOCK_MD} />)
    await mathPreview.click()
    await expect.element(mathSource).toBeVisible()

    await selector.click()
    await page.getByRole('option', { name: 'Python', exact: true }).click()

    await expect.element(mathPreview).not.toBeInTheDocument()
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('```python\nE=mc^2\n```')
    })
  })
})

const mermaidPreview = page.getByTestId('code-block-mermaid-preview')
const mermaidSource = page.locate('.ProseMirror pre[data-language="mermaid"]')

const MERMAID_BLOCK_MD = 'before\n\n```mermaid\nflowchart LR\n  A[Start] --> B[End]\n```'

describe('code block Mermaid preview', () => {
  it('shows only a Flowchart preview when the caret is outside', async () => {
    await render(<ProseKitEditor initialMarkdown={MERMAID_BLOCK_MD} />)

    await expect.element(mermaidPreview.locate('svg'), { timeout: 15000 }).toBeInTheDocument()
    await expect.element(mermaidPreview).toHaveTextContent('Start')
    await expect.element(mermaidSource).not.toBeVisible()
  })

  it('shows the source above the preview once the caret enters', async () => {
    await render(<ProseKitEditor initialMarkdown={MERMAID_BLOCK_MD} />)
    await expect.element(mermaidPreview.locate('svg'), { timeout: 15000 }).toBeInTheDocument()

    await mermaidPreview.click()

    await expect.element(mermaidSource).toBeVisible()
    await expect.element(mermaidPreview).toBeVisible()
    const source = mermaidSource.element()
    const preview = mermaidPreview.element()
    const position = source.compareDocumentPosition(preview)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('updates the Flowchart preview live while typing', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} initialMarkdown={MERMAID_BLOCK_MD} />)
    await expect.element(mermaidPreview.locate('svg'), { timeout: 15000 }).toBeInTheDocument()
    await mermaidPreview.click()
    ref.current?.setSelection('end')
    ref.current?.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('  B --> Done')

    await expect.element(mermaidPreview).toHaveTextContent('Done')
  })

  it('renders a Sequence diagram', async () => {
    const markdown =
      'before\n\n```mermaid\nsequenceDiagram\n  Alice->>Bob: Hello Bob\n  Bob-->>Alice: Hello Alice\n```'
    await render(<ProseKitEditor initialMarkdown={markdown} />)

    await expect.element(mermaidPreview.locate('svg'), { timeout: 15000 }).toBeInTheDocument()
    await expect.element(mermaidPreview).toHaveTextContent('Hello Bob')
    await expect.element(mermaidPreview).toHaveTextContent('Hello Alice')
  })

  it('keeps the source visible for an empty Mermaid block', async () => {
    await render(<ProseKitEditor initialMarkdown={'before\n\n```mermaid\n```'} />)

    await expect.element(mermaidSource).toBeVisible()
  })

  it('shows an editable error for unsupported syntax', async () => {
    await render(
      <ProseKitEditor initialMarkdown={'before\n\n```mermaid\npie\n  "Dogs" : 10\n```'} />,
    )
    await expect.element(mermaidPreview, { timeout: 15000 }).toHaveAttribute('data-error')
    await expect.element(mermaidSource).not.toBeVisible()

    await mermaidPreview.click()

    await expect.element(mermaidSource).toBeVisible()
  })

  it('drops the preview when the language changes', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} initialMarkdown={MERMAID_BLOCK_MD} />)
    await expect.element(mermaidPreview.locate('svg'), { timeout: 15000 }).toBeInTheDocument()
    await mermaidPreview.click()

    await selector.click()
    await page.getByRole('option', { name: 'TypeScript', exact: true }).click()

    await expect.element(mermaidPreview).not.toBeInTheDocument()
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain(
        '```typescript\nflowchart LR\n  A[Start] --> B[End]\n```',
      )
    })
  })

  it('keeps hostile labels passive', async () => {
    const markdown =
      'before\n\n```mermaid\nflowchart LR\n  A[<script>alert(1)</script><img src=x onerror=alert(1)> & safe] --> B\n```'
    await render(<ProseKitEditor initialMarkdown={markdown} />)

    await expect.element(mermaidPreview.locate('svg'), { timeout: 15000 }).toBeInTheDocument()
    await expect.element(mermaidPreview.locate('script')).not.toBeInTheDocument()
    await expect.element(mermaidPreview.locate('img')).not.toBeInTheDocument()
    await expect.element(mermaidPreview.locate('[onerror]')).not.toBeInTheDocument()
  })
})
