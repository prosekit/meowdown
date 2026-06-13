import '../testing/index.ts'

import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

const selector = page.getByTestId('code-block-language')
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

  it('copies the code block contents to the clipboard', async () => {
    await render(<ProseKitEditor initialMarkdown={CODE_BLOCK_MD} />)
    await expect.element(copyButton).toBeInTheDocument()

    await copyButton.click()

    await expect.element(copyButton).toHaveAttribute('data-copied')
    expect(await navigator.clipboard.readText()).toBe('fn main() {}')
  })
})
