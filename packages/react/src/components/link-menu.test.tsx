import '../testing/index.ts'

import type { LinkPreview } from '@meowdown/core'
import { readClipboard } from '@meowdown/vitest/clipboard'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { hover, unhover } from '../testing/mouse.ts'

import { MeowdownEditor } from './editor.tsx'
import type { EditorHandle } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const popover = page.getByTestId('link-popover')

describe('LinkMenu', () => {
  it('shows loading and then rich metadata', async () => {
    let resolvePreview: (preview: LinkPreview | undefined) => void = () => undefined
    const resolver = vi.fn(
      () =>
        new Promise<LinkPreview | undefined>((resolve) => {
          resolvePreview = resolve
        }),
    )
    await render(
      <MeowdownEditor
        initialMarkdown="[https://example.com](https://example.com)"
        resolveLinkPreview={resolver}
      />,
    )

    await hover(pmRoot.getByRole('link', { name: 'https://example.com' }))
    await expect.element(popover.getByTestId('link-popover-loading')).toBeVisible()
    await hover(popover)
    resolvePreview({
      title: 'Example Domain',
      description: 'A useful example page.',
      iconSrc: 'data:image/png;base64,iVBORw0KGgo=',
    })

    await expect.element(popover.getByText('Example Domain')).toBeVisible()
    await expect.element(popover.getByText('example.com')).toBeVisible()
    await expect.element(popover.getByText('A useful example page.')).toBeVisible()
    await expect.element(popover.getByText('Replace URL with its title?')).toBeVisible()
  })

  it('silently falls back to the URL and actions when metadata fails', async () => {
    const screen = await render(
      <MeowdownEditor
        initialMarkdown="[Docs](https://example.com)"
        resolveLinkPreview={() => Promise.reject(new Error('offline'))}
      />,
    )

    await hover(screen.getByText('Docs'))
    await expect.element(popover.getByText('https://example.com')).toBeVisible()
    await expect.element(popover.getByRole('button', { name: 'Copy link' })).toBeVisible()
    await expect.element(popover.getByRole('button', { name: 'Edit link' })).toBeVisible()
    await expect.element(popover.getByRole('button', { name: 'Remove link' })).toBeVisible()
  })

  it('keeps non-web destinations actions-only without resolving metadata', async () => {
    const resolver = vi.fn(() => ({ title: 'Never used' }))
    await render(
      <MeowdownEditor initialMarkdown="[File](file:///tmp/a.txt)" resolveLinkPreview={resolver} />,
    )

    await hover(pmRoot.getByRole('link', { name: 'File' }))
    await expect.element(popover.getByText('file:///tmp/a.txt')).toBeVisible()
    expect(resolver).not.toHaveBeenCalled()
  })

  it('ignores a stale metadata response after moving to another link', async () => {
    const pending = new Map<string, (preview: LinkPreview | undefined) => void>()
    const resolver = (href: string) =>
      new Promise<LinkPreview | undefined>((resolve) => pending.set(href, resolve))
    await render(
      <MeowdownEditor
        initialMarkdown="[First](https://first.test) and [Second](https://second.test)"
        resolveLinkPreview={resolver}
      />,
    )

    await unhover()
    await hover(pmRoot.getByRole('link', { name: 'First' }))
    await expect.element(popover.getByTestId('link-popover-loading')).toBeVisible()
    await vi.waitFor(() => expect(pending.has('https://first.test')).toBe(true))
    await hover(pmRoot.getByRole('link', { name: 'Second' }))
    await vi.waitFor(() => expect(pending.has('https://second.test')).toBe(true))
    await hover(popover)
    pending.get('https://second.test')?.({ title: 'Second title' })
    await expect.element(popover.getByText('Second title')).toBeVisible()
    pending.get('https://first.test')?.({ title: 'Stale first title' })
    await expect.element(popover.getByText('Stale first title')).not.toBeInTheDocument()
    await expect.element(popover.getByText('Second title')).toBeVisible()
  })

  it('replaces only a URL label with the resolved title', async () => {
    const ref = createRef<EditorHandle>()
    let resolvePreview: (preview: LinkPreview | undefined) => void = () => undefined
    await render(
      <MeowdownEditor
        handleRef={ref}
        initialMarkdown="[https://example.com](https://example.com)"
        resolveLinkPreview={() =>
          new Promise((resolve) => {
            resolvePreview = resolve
          })
        }
      />,
    )

    await hover(pmRoot.getByRole('link', { name: 'https://example.com' }))
    await expect.element(popover.getByTestId('link-popover-loading')).toBeVisible()
    await hover(popover)
    resolvePreview({ title: 'Example Domain' })
    await popover.getByRole('button', { name: 'Yes' }).click()
    expect(ref.current?.getMarkdown()).toContain('[Example Domain](https://example.com)')
  })

  it('does not offer title replacement for an intentional label', async () => {
    let resolvePreview: (preview: LinkPreview | undefined) => void = () => undefined
    const screen = await render(
      <MeowdownEditor
        initialMarkdown="[My label](https://example.com)"
        resolveLinkPreview={() =>
          new Promise((resolve) => {
            resolvePreview = resolve
          })
        }
      />,
    )

    await hover(screen.getByText('My label'))
    await expect.element(popover.getByTestId('link-popover-loading')).toBeVisible()
    await hover(popover)
    resolvePreview({ title: 'Example Domain' })
    await expect.element(popover.getByText('Example Domain')).toBeVisible()
    await expect.element(popover.getByText('Replace URL with its title?')).not.toBeInTheDocument()
  })

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
    await hover(screen.getByText('Docs'))
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
    await hover(link)
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
    await hover(link)
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
    await hover(link)
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
    await hover(screen.getByText('Docs'))
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
    await hover(screen.getByText('Docs'))
    await popover.getByRole('button', { name: 'Edit link' }).click()
    await expect.element(popover.getByTestId('link-popover-edit')).toBeVisible()
    await popover.getByTestId('link-popover-input').fill('https://new.test')
    await userEvent.keyboard('{Enter}')
    await expect.element(pmRoot.getByText('https://new.test')).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toContain('[Docs](https://new.test)')
  })

  it('edits visible text while preserving the hidden CommonMark tooltip', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <MeowdownEditor handleRef={ref} initialMarkdown={'[Docs](https://old.test "Tooltip")'} />,
    )
    await hover(screen.getByText('Docs'))
    await popover.getByRole('button', { name: 'Edit link' }).click()
    await popover.getByTestId('link-popover-text-input').fill('New docs')
    await popover.getByTestId('link-popover-input').fill('https://new.test')
    await popover.getByRole('button', { name: 'Save' }).click()

    expect(ref.current?.getMarkdown()).toContain('[New docs](https://new.test "Tooltip")')
  })

  it('offers page-title replacement from the keyboard edit form', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <MeowdownEditor
        handleRef={ref}
        initialMarkdown="https://example.com"
        resolveLinkPreview={() => ({ title: 'Example Domain' })}
      />,
    )
    await screen.getByText('https://example.com').click()
    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}')
    await expect.element(popover.getByRole('button', { name: 'Use page title' })).toBeVisible()
    await popover.getByRole('button', { name: 'Use page title' }).click()
    await popover.getByRole('button', { name: 'Save' }).click()

    expect(ref.current?.getMarkdown()).toContain('[Example Domain](https://example.com)')
  })

  it('focuses Text on Mod-k and dismisses with Escape', async () => {
    const screen = await render(<MeowdownEditor initialMarkdown="[Docs](https://example.com)" />)
    await screen.getByText('Docs').click()
    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}')
    const textInput = popover.getByTestId('link-popover-text-input')
    await expect.element(textInput).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expect.element(popover).not.toBeInTheDocument()
  })

  it('keeps reference links read-only in the preview and Mod-k flow', async () => {
    const ref = createRef<EditorHandle>()
    const markdown = '[Docs][doc]\n\n[doc]: https://example.com'
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown={markdown} />)
    const label = screen.getByText('Docs')

    await hover(label)
    await expect.element(popover.getByTestId('link-popover-read')).toBeVisible()
    await expect.element(popover.locate('a')).toHaveAttribute('href', 'https://example.com')
    await expect.element(popover.getByRole('button', { name: 'Edit link' })).not.toBeInTheDocument()
    await expect
      .element(popover.getByRole('button', { name: 'Remove link' }))
      .not.toBeInTheDocument()

    await label.click()
    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}')
    await expect.element(popover.getByTestId('link-popover-edit')).not.toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe(markdown + '\n')
  })
})
