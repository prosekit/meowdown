import '../testing/index.ts'

import { readClipboard } from '@meowdown/vitest/clipboard'
import { noop } from '@ocavue/utils'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { hover } from '../testing/mouse.ts'
import { createYouTubeVideo } from '../testing/youtube-fixture.ts'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

const TWEET = 'https://x.com/jack/status/20'
const VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

const card = page.getByTestId('x-post-embed')
const menuButton = page.getByTestId('embed-menu')
const convertItem = page.getByTestId('embed-menu-convert')
const copyItem = page.getByTestId('embed-menu-copy')
const deleteItem = page.getByTestId('embed-menu-delete')
const IMAGE =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'/%3E"

async function setup(markdown: string, readOnly = false) {
  const ref = createRef<EditorHandle>()
  await render(
    <ProseKitEditor ref={ref} initialMarkdown={markdown} resolveXPost={noop} readOnly={readOnly} />,
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

  it('closes when its button is clicked again', async () => {
    await setup(`![](${TWEET})`)

    await openFromButton()
    await menuButton.click()

    await expect.element(copyItem).not.toBeInTheDocument()
    await expect.element(menuButton).not.toHaveAttribute('aria-expanded')
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
    await expect.element(deleteItem).not.toBeInTheDocument()
  })

  it('deletes a card, and undo brings it back', async () => {
    const ref = await setup(`Before ![](${TWEET}) after`)

    await openFromButton()
    await deleteItem.click()

    await expect.element(card).not.toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe('Before  after\n')

    // The caret sits where the card was, in a focused editor.
    await userEvent.keyboard('ok')
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toBe('Before ok after\n')
    })

    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}')
    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}')
    await expect.element(card).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe(`Before ![](${TWEET}) after\n`)
  })

  describe('on an image', () => {
    const preview = page.getByTestId('image-preview')

    async function openImageMenu(markdown: string) {
      const ref = createRef<EditorHandle>()
      await render(
        <ProseKitEditor ref={ref} initialMarkdown={markdown} resolveImageUrl={(src) => src} />,
      )
      await expect.element(preview).toBeInTheDocument()
      await hover(preview)
      await menuButton.click()
      await expect.element(copyItem).toBeVisible()
      return ref
    }

    it('copies the image link and offers no conversion', async () => {
      await openImageMenu(`![Logo](${IMAGE})<!-- {"width":80} -->`)

      await expect.element(copyItem).toHaveTextContent('Copy image link')
      await expect.element(convertItem).not.toBeInTheDocument()
      await copyItem.click()
      await vi.waitFor(async () => {
        expect((await readClipboard()).text).toBe(IMAGE)
      })
    })

    it('deletes the image with its size comment', async () => {
      const ref = await openImageMenu(`A ![Logo](${IMAGE})<!-- {"width":80} --> B`)

      await deleteItem.click()
      await expect.element(preview).not.toBeInTheDocument()
      expect(ref.current?.getMarkdown()).toBe('A  B\n')
    })

    it('opens with Mod-/ on a selected image', async () => {
      const ref = createRef<EditorHandle>()
      await render(
        <ProseKitEditor
          ref={ref}
          initialMarkdown={`![Logo](${IMAGE})`}
          resolveImageUrl={(src) => src}
        />,
      )
      await expect.element(preview).toBeInTheDocument()
      ref.current?.setSelection('start')
      ref.current?.focus()
      await userEvent.keyboard('{ArrowRight}')
      await userEvent.keyboard('{ControlOrMeta>}/{/ControlOrMeta}')
      await expect.element(copyItem).toBeVisible()
    })
  })
  it('stays anchored to the card while a YouTube card saves its snapshot', async () => {
    const video = Promise.withResolvers<ReturnType<typeof createYouTubeVideo>>()
    const ref = createRef<EditorHandle>()
    await render(
      <ProseKitEditor
        ref={ref}
        initialMarkdown={`![](${VIDEO})`}
        resolveYouTubeVideo={() => video.promise}
      />,
    )
    const youtube = page.getByTestId('youtube-video-embed')
    await hover(youtube)
    await menuButton.click()
    await expect.element(copyItem).toBeVisible()
    const button = menuButton.element()

    video.resolve(createYouTubeVideo())
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('"snapshot"')
    })

    expect(button.isConnected).toBe(true)
    await expect.element(menuButton).toHaveAttribute('aria-expanded', 'true')
    await convertItem.click()
    await vi.waitFor(() => {
      expect(ref.current?.getMarkdown()).toBe(`${VIDEO}\n`)
    })
  })
})
