import '../testing/index.ts'

import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import { hover } from '../testing/mouse.ts'

import { Editor } from './editor.tsx'
import type { LinkClickHandler, WikilinkClickHandler } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const wikilink = page.locate('.ProseMirror .md-wikilink').first()
const link = page.locate('.ProseMirror a').first()
const card = page.getByTestId('link-hover-card')

describe('LinkHoverCard', () => {
  it('opens a custom wikilink hover card after dwell', async () => {
    const screen = await render(
      <Editor
        initialMarkdown="See [[Charlotte]] here."
        onWikilinkHover={(context) => <div data-testid="note-preview">{context.target}</div>}
      />,
    )
    await pmRoot.click()
    await hover(wikilink)

    await expect.element(screen.getByTestId('note-preview')).toBeVisible()
    await expect.element(screen.getByTestId('note-preview')).toHaveTextContent('Charlotte')
  })

  it('resolves an async wikilink hover card', async () => {
    const screen = await render(
      <Editor
        initialMarkdown="See [[Charlotte]] here."
        onWikilinkHover={(context) =>
          Promise.resolve(<div data-testid="note-preview">{context.target}</div>)
        }
      />,
    )
    await pmRoot.click()
    await hover(wikilink)

    await expect.element(screen.getByTestId('note-preview')).toHaveTextContent('Charlotte')
  })

  it('navigates a wikilink on Mod+click but not on a plain click', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    await render(
      <Editor initialMarkdown="See [[Charlotte]] here." onWikilinkClick={onWikilinkClick} />,
    )
    await pmRoot.click()

    await wikilink.click()
    expect(onWikilinkClick).not.toHaveBeenCalled()

    await wikilink.click({ modifiers: ['ControlOrMeta'] })
    expect(onWikilinkClick).toHaveBeenCalledTimes(1)
    expect(onWikilinkClick.mock.calls[0][0].target).toBe('Charlotte')
  })

  it('shows the default link card and its Open action fires onLinkClick', async () => {
    const onLinkClick = vi.fn<LinkClickHandler>()
    await render(
      <Editor initialMarkdown="see [docs](http://x.test) end" onLinkClick={onLinkClick} />,
    )
    await pmRoot.click()
    await hover(link)

    await expect.element(card).toBeVisible()
    await page.getByTestId('link-card-open').click()
    expect(onLinkClick).toHaveBeenCalledTimes(1)
    expect(onLinkClick.mock.calls[0][0].href).toBe('http://x.test')
  })

  it('ignores the hover/click props in source mode', async () => {
    const onWikilinkClick = vi.fn()
    await render(
      <Editor
        mode="source"
        initialMarkdown="See [[Charlotte]] here."
        onWikilinkHover={() => <div data-testid="note-preview">x</div>}
        onWikilinkClick={onWikilinkClick}
      />,
    )
    await expect.element(page.locate('.cm-editor')).toBeInTheDocument()
    await expect.element(card).not.toBeInTheDocument()
  })
})
