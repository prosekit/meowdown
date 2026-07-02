import '../testing/index.ts'

import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import { MeowdownEditor } from './editor.tsx'
import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

const preview = page.getByTestId('pending-replacement')
const previewText = page.getByTestId('pending-replacement-text')
const acceptButton = page.getByTestId('pending-replacement-accept')
const discardButton = page.getByTestId('pending-replacement-discard')

// The doc is one paragraph 'say hello end'; 'hello' spans positions 5..10.
const HELLO_RANGE = { from: 5, to: 10 } as const

describe('PendingReplacementPreview', () => {
  it('shows streamed text without touching the document', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} initialMarkdown="say hello end" />)

    expect(ref.current?.startPendingReplacement({ ...HELLO_RANGE, mode: 'replace' })).toBe(true)
    await expect.element(preview).toBeVisible()
    await expect.element(previewText.getByText('Waiting for text...')).toBeVisible()
    await expect.element(acceptButton).toBeDisabled()

    ref.current?.appendPendingReplacementText('good')
    ref.current?.appendPendingReplacementText('bye')
    await expect.element(previewText.getByText('goodbye')).toBeVisible()
    await expect.element(acceptButton).not.toBeDisabled()
    expect(ref.current?.getMarkdown()).toBe('say hello end\n')
  })

  it('Accept applies the text and reports the outcome', async () => {
    const ref = createRef<EditorHandle>()
    const onResolve = vi.fn()
    await render(
      <ProseKitEditor
        ref={ref}
        initialMarkdown="say hello end"
        onPendingReplacementResolve={onResolve}
      />,
    )

    ref.current?.startPendingReplacement({ ...HELLO_RANGE, mode: 'replace' })
    ref.current?.appendPendingReplacementText('goodbye')
    await expect.element(acceptButton).not.toBeDisabled()
    await acceptButton.click()

    await expect.element(preview).not.toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe('say goodbye end\n')
    expect(onResolve).toHaveBeenCalledWith('accepted', expect.objectContaining({ text: 'goodbye' }))
  })

  it('Discard leaves the markdown byte-identical and reports the outcome', async () => {
    const ref = createRef<EditorHandle>()
    const onResolve = vi.fn()
    await render(
      <ProseKitEditor
        ref={ref}
        initialMarkdown="say hello end"
        onPendingReplacementResolve={onResolve}
      />,
    )
    const before = ref.current?.getMarkdown()

    ref.current?.startPendingReplacement({ ...HELLO_RANGE, mode: 'replace' })
    ref.current?.appendPendingReplacementText('goodbye')
    await expect.element(preview).toBeVisible()
    await discardButton.click()

    await expect.element(preview).not.toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe(before)
    expect(onResolve).toHaveBeenCalledWith(
      'discarded',
      expect.objectContaining({ text: 'goodbye' }),
    )
  })

  it('renders host actions in the footer', async () => {
    const ref = createRef<EditorHandle>()
    await render(
      <MeowdownEditor
        handleRef={ref}
        initialMarkdown="say hello end"
        pendingReplacementActions={<button type="button">Retry</button>}
      />,
    )

    ref.current?.startPendingReplacement({ ...HELLO_RANGE, mode: 'replace' })
    await expect.element(preview.getByRole('button', { name: 'Retry' })).toBeVisible()
  })

  it('restarting the stage resets the preview text (retry)', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} initialMarkdown="say hello end" />)

    ref.current?.startPendingReplacement({ ...HELLO_RANGE, mode: 'replace' })
    ref.current?.appendPendingReplacementText('first attempt')
    await expect.element(previewText.getByText('first attempt')).toBeVisible()

    ref.current?.startPendingReplacement({ ...HELLO_RANGE, mode: 'replace' })
    await expect.element(previewText.getByText('Waiting for text...')).toBeVisible()

    ref.current?.appendPendingReplacementText('second attempt')
    await expect.element(previewText.getByText('second attempt')).toBeVisible()
  })
})
