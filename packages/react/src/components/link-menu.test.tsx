import '../testing/index.ts'

import { readClipboard } from '@meowdown/vitest/clipboard'
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
    expect((await readClipboard()).text).toBe('https://example.com')
  })

  it('anchors the preview to the link when hidden syntax ends the block', async () => {
    // The whole block is one link: the hidden `](url)` syntax reaches the block
    // boundary, so a unit-edge measurement has no visible neighbor to snap to
    // and used to collapse to a zero rect at the viewport origin.
    const label = 'export-Meters-1780294218812-20260601.xlsx'
    const screen = await render(
      <MeowdownEditor initialMarkdown={`[${label}](assets/export.xlsx)`} />,
    )
    const link = screen.getByText(label)
    await link.hover()
    await expect.element(popover.getByTestId('link-popover-read')).toBeVisible()

    const linkRect = link.element().getBoundingClientRect()
    const popRect = popover.element().getBoundingClientRect()
    // Just below the link: the popover sits `sideOffset` (8px, minus rounding)
    // under the text box. An anchor measured at the baseline lands closer.
    expect(popRect.top).toBeGreaterThanOrEqual(linkRect.bottom + 7)
    expect(popRect.top).toBeLessThan(linkRect.bottom + 40)
    // ...and centered on it, not dragged toward the viewport corner.
    const linkCenter = (linkRect.left + linkRect.right) / 2
    const popCenter = (popRect.left + popRect.right) / 2
    expect(Math.abs(popCenter - linkCenter)).toBeLessThan(20)
  })

  it('anchors the preview to an angle autolink mid-line', async () => {
    // `<`/`>` are hidden syntax: a whole-unit anchor measures the collapsed
    // glyphs and sits on the baseline instead of the text box.
    await render(<MeowdownEditor initialMarkdown="see <https://www.example.com> here" />)
    const link = pmRoot.getByText('https://www.example.com')
    await link.hover()
    await expect.element(popover.getByTestId('link-popover-read')).toBeVisible()

    const linkRect = link.element().getBoundingClientRect()
    const popRect = popover.element().getBoundingClientRect()
    expect(popRect.top).toBeGreaterThanOrEqual(linkRect.bottom + 7)
    expect(popRect.top).toBeLessThan(linkRect.bottom + 40)
    const linkCenter = (linkRect.left + linkRect.right) / 2
    const popCenter = (popRect.left + popRect.right) / 2
    expect(Math.abs(popCenter - linkCenter)).toBeLessThan(20)
  })

  it('anchors the preview to an angle autolink alone in its block', async () => {
    // Both unit edges sit at block boundaries next to the hidden `<`/`>`:
    // WebKit measures zero rects on both sides and used to pin the popover at
    // the viewport corner. Park the caret in the other paragraph first; the
    // initial caret at doc start sits inside the autolink and focus mode
    // reveals the brackets, masking the bug.
    await render(
      <MeowdownEditor initialMarkdown={'<https://www.example.com>\n\npark the caret here'} />,
    )
    await pmRoot.getByText('park the caret here').click()
    const link = pmRoot.getByText('https://www.example.com')
    await link.hover()
    await expect.element(popover.getByTestId('link-popover-read')).toBeVisible()

    const linkRect = link.element().getBoundingClientRect()
    const popRect = popover.element().getBoundingClientRect()
    expect(popRect.top).toBeGreaterThanOrEqual(linkRect.bottom + 7)
    expect(popRect.top).toBeLessThan(linkRect.bottom + 40)
    const linkCenter = (linkRect.left + linkRect.right) / 2
    const popCenter = (popRect.left + popRect.right) / 2
    expect(Math.abs(popCenter - linkCenter)).toBeLessThan(20)
  })

  it('anchors the edit form to a selected wikilink alone in its block', async () => {
    // The wikilink source is hidden atom text (`font-size: 0`) and both
    // selection edges sit at block boundaries, so a raw-selection anchor has
    // no visible glyph to measure on either side.
    // Wide enough for the popup to center on the pill without being pushed
    // aside by the viewport edge.
    await render(<MeowdownEditor initialMarkdown="[[A rather long note title for the anchor]]" />)
    const wikilink = pmRoot.getByTestId('wikilink')
    await wikilink.click()
    await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}')
    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}')
    await expect.element(popover.getByTestId('link-popover-edit')).toBeVisible()

    await vi.waitFor(() => {
      const linkRect = wikilink.element().getBoundingClientRect()
      const popRect = popover.element().getBoundingClientRect()
      expect(popRect.top).toBeGreaterThanOrEqual(linkRect.bottom + 7)
      expect(popRect.top).toBeLessThan(linkRect.bottom + 40)
      const linkCenter = (linkRect.left + linkRect.right) / 2
      const popCenter = (popRect.left + popRect.right) / 2
      expect(Math.abs(popCenter - linkCenter)).toBeLessThan(20)
    })
  })

  it('anchors the edit form to a selection ending in hidden link syntax', async () => {
    // Select-all reaches the block end behind the hidden `](url)` run, so the
    // raw-selection end edge has no visible glyph on either side; the anchor
    // must fall back to the last visible glyph before the run.
    await render(
      <MeowdownEditor initialMarkdown="read the [long linked documentation](https://example.com)" />,
    )
    const label = pmRoot.getByText('long linked documentation')
    await label.click()
    await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}')
    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}')
    await expect.element(popover.getByTestId('link-popover-edit')).toBeVisible()

    await vi.waitFor(() => {
      const labelRect = label.element().getBoundingClientRect()
      const popRect = popover.element().getBoundingClientRect()
      expect(popRect.top).toBeGreaterThanOrEqual(labelRect.bottom + 7)
      expect(popRect.top).toBeLessThan(labelRect.bottom + 40)
      // The anchor spans the visible text: from the paragraph's first glyph to
      // the end of the label, skipping the hidden trailing syntax.
      const paragraphRect = pmRoot.getByText('read the').element().getBoundingClientRect()
      const anchorCenter = (paragraphRect.left + labelRect.right) / 2
      const popCenter = (popRect.left + popRect.right) / 2
      expect(Math.abs(popCenter - anchorCenter)).toBeLessThan(20)
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
