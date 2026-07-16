import '../testing/index.ts'

import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

vi.mock('../hooks/use-beautiful-mermaid.ts', () => ({
  useBeautifulMermaid: () => undefined,
}))

import { ProseKitEditor } from './prosekit-editor.tsx'

describe('code block Mermaid loading', () => {
  it('keeps the source visible while the renderer loads', async () => {
    await render(
      <ProseKitEditor initialMarkdown={'before\n\n```mermaid\nflowchart LR\n  A --> B\n```'} />,
    )

    await expect.element(page.locate('.ProseMirror pre[data-language="mermaid"]')).toBeVisible()
    await expect.element(page.getByTestId('code-block-mermaid-preview')).not.toBeInTheDocument()
  })
})
