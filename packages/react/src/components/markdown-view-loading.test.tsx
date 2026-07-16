import '../testing/index.ts'

import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

vi.mock('../hooks/use-beautiful-mermaid.ts', () => ({
  useBeautifulMermaid: () => undefined,
}))

import { MarkdownView } from './markdown-view.tsx'

describe('MarkdownView Mermaid loading', () => {
  it('renders the source while the renderer loads', async () => {
    await render(
      <div data-testid="markdown-view-loading">
        <MarkdownView markdown={'```mermaid\nflowchart LR\n  A --> B\n```'} />
      </div>,
    )

    const view = page.getByTestId('markdown-view-loading')
    await expect.element(view.locate('pre[data-language="mermaid"]')).toBeVisible()
    await expect.element(view.getByTestId('code-block-mermaid-preview')).not.toBeInTheDocument()
  })
})
