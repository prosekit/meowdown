import '../testing/index.ts'

import { readClipboard } from '@meowdown/vitest/clipboard'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { hover } from '../testing/mouse.ts'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

const TWEET = 'https://x.com/jack/status/20'

const card = page.getByTestId('x-post-embed')
const menuButton = page.getByTestId('embed-menu')
const convertItem = page.getByTestId('embed-menu-convert')
const copyItem = page.getByTestId('embed-menu-copy')

async function setup(markdown: string, readOnly = false) {
  const ref = createRef<EditorHandle>()
  await render(
    <ProseKitEditor
      ref={ref}
      initialMarkdown={markdown}
      resolveXPost={() => undefined}
      readOnly={readOnly}
    />,
  )
  await expect.element(card).toBeInTheDocument()
  return ref
}

async function openFromButton() {
  await hover(card)
  await menuButton.click()
  await expect.element(copyItem).toBeVisible()
}

describe('embed menu', () => {
  it('converts a card to its bare URL, and undo brings the card back', async () => {
    const ref = await setup(`Before ![](${TWEET}) after`)

    await openFromButton()
    await expect.element(menuButton).toHaveAttribute('aria-expanded', 'true')
    await convertItem.click()

    await expect.element(card).not.toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe(`Before ${TWEET} after\n`)

    // The caret sits after the link, in a focused editor.
    await userEvent.keyboard(' ok')
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toBe(`Before ${TWEET} ok after\n`)
    })

    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}')
    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}')
    await expect.element(card).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe(`Before ![](${TWEET}) after\n`)
  })

  it('keeps the alt text and title, and drops the magic comment', async () => {
    const ref = await setup(`![Jack's post](${TWEET} "First")<!-- {"width":320} -->`)

    await openFromButton()
    await convertItem.click()

    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toBe(`[Jack's post](${TWEET} "First")\n`)
    })
  })

  it('opens with Mod-/ on a selected card and returns the focus to the editor', async () => {
    const ref = await setup(`![](${TWEET})`)
    ref.current?.setSelection('start')
    ref.current?.focus()
    await userEvent.keyboard('{ArrowRight}')

    await userEvent.keyboard('{ControlOrMeta>}/{/ControlOrMeta}')
    await expect.element(convertItem).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect.element(convertItem).not.toBeInTheDocument()
    await expect.element(menuButton).not.toHaveAttribute('aria-expanded')

    // The card is still selected, so typing replaces it.
    await userEvent.keyboard('x')
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toBe('x\n')
    })
  })

  it('converts with the keyboard only', async () => {
    const ref = await setup(`![](${TWEET})`)
    ref.current?.setSelection('start')
    ref.current?.focus()
    await userEvent.keyboard('{ArrowRight}')

    await userEvent.keyboard('{ControlOrMeta>}/{/ControlOrMeta}')
    await expect.element(convertItem).toBeVisible()
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(convertItem).toHaveAttribute('data-highlighted')
    await userEvent.keyboard('{Enter}')

    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toBe(`${TWEET}\n`)
    })
  })

  it('copies the link', async () => {
    await setup(`![](${TWEET})`)

    await openFromButton()
    await copyItem.click()

    await expect.element(copyItem).not.toBeInTheDocument()
    await vi.waitFor(async () => {
      expect((await readClipboard()).text).toBe(TWEET)
    })
  })

  it('offers only the copy action in a read-only editor', async () => {
    await setup(`![](${TWEET})`, true)

    await openFromButton()
    await expect.element(convertItem).not.toBeInTheDocument()
  })
})
