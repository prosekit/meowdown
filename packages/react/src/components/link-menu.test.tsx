import '../testing/index.ts'

import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { MeowdownEditor } from './editor.tsx'
import type { EditorHandle } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const popover = page.getByTestId('link-popover')

describe('LinkMenu', () => {
  it('shows the read preview on hover and copies the href', async () => {
    const onLinkCopy = vi.fn()
    const screen = await render(
      <MeowdownEditor
        initialMarkdown="see [Docs](https://example.com) here"
        onLinkCopy={onLinkCopy}
      />,
    )
    // Focus the document first; `clipboard.writeText` rejects otherwise.
    await pmRoot.click()
    await screen.getByText('Docs').hover()
    await expect.element(popover.getByTestId('link-popover-read')).toBeVisible()
    await popover.getByRole('button', { name: 'Copy link' }).click()
    await vi.waitFor(() => {
      expect(onLinkCopy).toHaveBeenCalledWith({ href: 'https://example.com' })
    })
  })

  it('creates a link from a selection with Mod-k', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="Docs" />)
    await screen.getByText('Docs').click()
    await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}')
    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}')
    await expect.element(popover.getByTestId('link-popover-edit')).toBeVisible()
    await popover.getByTestId('link-popover-input').fill('https://example.com')
    await userEvent.keyboard('{Enter}')
    await expect.element(pmRoot.getByText('https://example.com')).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toContain('[Docs](https://example.com)')
  })

  it('removes a link from the read preview', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <MeowdownEditor handleRef={ref} initialMarkdown="a [Docs](https://example.com) b" />,
    )
    await screen.getByText('Docs').hover()
    await popover.getByRole('button', { name: 'Remove link' }).click()
    await expect.element(popover).not.toBeInTheDocument()
    const markdown = ref.current?.getMarkdown() ?? ''
    expect(markdown).toContain('a Docs b')
    expect(markdown).not.toContain('https://example.com')
  })

  it('edits a link href from the read preview', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <MeowdownEditor handleRef={ref} initialMarkdown="[Docs](https://old.test)" />,
    )
    await screen.getByText('Docs').hover()
    await popover.getByRole('button', { name: 'Edit link' }).click()
    await expect.element(popover.getByTestId('link-popover-edit')).toBeVisible()
    await popover.getByTestId('link-popover-input').fill('https://new.test')
    await userEvent.keyboard('{Enter}')
    await expect.element(pmRoot.getByText('https://new.test')).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toContain('[Docs](https://new.test)')
  })
})
