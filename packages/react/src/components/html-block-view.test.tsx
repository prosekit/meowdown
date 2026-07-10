import '../testing/index.ts'

import { isApple } from '@prosekit/core'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { ProseKitEditor } from './prosekit-editor.tsx'

const source = page.getByTestId('html-block-source')
const preview = page.getByTestId('html-block-preview')

// A leading paragraph keeps the initial caret outside the HTML block.
const DIV_BLOCK_MD = 'before\n\n<div class="box">hello</div>'
const COMMENT_MD = 'before\n\n<!-- a note -->'

describe('html block preview', () => {
  it('shows only the rendered HTML when the caret is outside', async () => {
    await render(<ProseKitEditor initialMarkdown={DIV_BLOCK_MD} />)
    await expect.element(preview.locate('.box')).toBeInTheDocument()
    await expect.element(preview).toBeVisible()
    await expect.element(source).not.toBeVisible()
  })

  it('shows the source above the preview once the caret enters', async () => {
    await render(<ProseKitEditor initialMarkdown={DIV_BLOCK_MD} />)
    await expect.element(preview).toBeVisible()

    await preview.click()

    await expect.element(source).toBeVisible()
    await expect.element(preview).toBeVisible()
    const sourceEl = source.element()
    const previewEl = preview.element()
    const position = sourceEl.compareDocumentPosition(previewEl)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('updates the preview live while editing the source', async () => {
    await render(<ProseKitEditor initialMarkdown={DIV_BLOCK_MD} />)
    await preview.click()
    await expect.element(source).toBeVisible()

    // Clicking the preview drops the caret at the block start; typing there
    // extends the source, and the preview re-renders live.
    await userEvent.keyboard('x')

    await expect.element(preview).toHaveTextContent('xhello')
  })

  it('lets a details block toggle open on click without entering the source', async () => {
    await render(
      <ProseKitEditor
        initialMarkdown={'before\n\n<details><summary>More</summary>body</details>'}
      />,
    )
    const details = preview.locate('details')
    await expect.element(details).toBeInTheDocument()
    await expect.element(details).not.toHaveAttribute('open')

    await preview.locate('summary').click()

    await expect.element(details).toHaveAttribute('open')
    await expect.element(source).not.toBeVisible()
  })

  it('forces the source open on Mod-click of the preview', async () => {
    await render(<ProseKitEditor initialMarkdown={DIV_BLOCK_MD} />)
    await expect.element(preview).toBeVisible()

    const modifier = isApple ? 'Meta' : 'Control'
    await userEvent.keyboard(`{${modifier}>}`)
    await preview.click()
    await userEvent.keyboard(`{/${modifier}}`)

    await expect.element(source).toBeVisible()
  })

  it('always shows the source for a comment block', async () => {
    await render(<ProseKitEditor initialMarkdown={COMMENT_MD} />)
    await expect.element(source).toBeVisible()
    await expect.element(source).toHaveTextContent('<!-- a note -->')
    await expect.element(preview).not.toBeInTheDocument()
  })

  it('strips a script tag from the preview', async () => {
    await render(
      <ProseKitEditor initialMarkdown={'before\n\n<div>ok<script>alert(1)</script></div>'} />,
    )
    await expect.element(preview.locate('div')).toBeInTheDocument()
    expect(preview.element().querySelector('script')).toBeNull()
  })

  it('keeps every block source-only when renderHTMLPreview is false', async () => {
    await render(<ProseKitEditor initialMarkdown={DIV_BLOCK_MD} renderHTMLPreview={false} />)
    await expect.element(source).toBeVisible()
    await expect.element(source).toHaveTextContent('<div class="box">hello</div>')
    await expect.element(preview).not.toBeInTheDocument()
  })
})
