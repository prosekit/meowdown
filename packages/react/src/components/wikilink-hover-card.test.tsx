import '../testing/index.ts'

import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import { hover, unhover } from '../testing/mouse.ts'

import { MeowdownEditor } from './editor.tsx'
import type { EditorHandle } from './types.ts'
import { WikilinkHoverCard } from './wikilink-hover-card.tsx'

const pmRoot = page.locate('.ProseMirror')
const card = page.getByTestId('wikilink-hover-card')

function PreviewCard() {
  return (
    <WikilinkHoverCard>
      {(target) => <div data-testid="hover-body">Preview: {target}</div>}
    </WikilinkHoverCard>
  )
}

describe('WikilinkHoverCard', () => {
  it('opens after a 300ms dwell and closes immediately on leave', async () => {
    await unhover()
    await render(
      <MeowdownEditor initialMarkdown="see [[Note]] here" blockHandle={false}>
        <PreviewCard />
      </MeowdownEditor>,
    )

    await hover(pmRoot.getByTestId('wikilink'))
    await expect.element(card).not.toBeInTheDocument()
    await expect.element(card, { timeout: 1000 }).toHaveTextContent('Preview: Note')

    await unhover()
    await expect.element(card).not.toBeInTheDocument()
  })

  it('restarts the dwell when the pointer moves to an adjacent target', async () => {
    await unhover()
    await render(
      <MeowdownEditor
        initialMarkdown="[[Alpha|A wide alias]][[Beta|Another wide alias]]"
        blockHandle={false}
      >
        <PreviewCard />
      </MeowdownEditor>,
    )
    const links = pmRoot.getByTestId('wikilink')

    await hover(links.nth(0))
    await new Promise((resolve) => setTimeout(resolve, 200))
    await hover(links.nth(1))
    await new Promise((resolve) => setTimeout(resolve, 150))
    await expect.element(card).not.toBeInTheDocument()
    await expect.element(card, { timeout: 1000 }).toHaveTextContent('Preview: Beta')
  })

  it('renders no card when the render prop returns null for the target', async () => {
    await unhover()
    await render(
      <MeowdownEditor initialMarkdown="[[Missing]] then [[Known]]" blockHandle={false}>
        <WikilinkHoverCard>
          {(target) => (target === 'Known' ? <div>Preview: {target}</div> : null)}
        </WikilinkHoverCard>
      </MeowdownEditor>,
    )
    const links = pmRoot.getByTestId('wikilink')

    await hover(links.nth(0))
    await new Promise((resolve) => setTimeout(resolve, 500))
    await expect.element(card).not.toBeInTheDocument()

    await hover(links.nth(1))
    await expect.element(card, { timeout: 1000 }).toHaveTextContent('Preview: Known')
  })

  it('preserves editor focus and selection and makes the popup inert', async () => {
    await unhover()
    const handleRef = createRef<EditorHandle>()
    await render(
      <MeowdownEditor
        handleRef={handleRef}
        initialMarkdown="before [[Note]] after"
        blockHandle={false}
      >
        <PreviewCard />
      </MeowdownEditor>,
    )
    handleRef.current?.setSelection({ type: 'text', anchor: 2, head: 2 })
    handleRef.current?.focus()
    const activeElement = document.activeElement
    const selection = handleRef.current?.getSelection()

    await hover(pmRoot.getByTestId('wikilink'))
    await expect.element(card, { timeout: 1000 }).toBeInTheDocument()

    expect(document.activeElement).toBe(activeElement)
    expect(handleRef.current?.getSelection()).toEqual(selection)
    await expect.element(card).toHaveAttribute('inert')
  })

  it('keeps the popup inside an 8px viewport margin near the bottom-right edge', async () => {
    await unhover()
    await render(
      <div style={{ position: 'fixed', right: 0, bottom: 0, width: 180 }}>
        <MeowdownEditor initialMarkdown="[[Edge]]" blockHandle={false}>
          <PreviewCard />
        </MeowdownEditor>
      </div>,
    )

    await hover(pmRoot.getByTestId('wikilink'))
    await expect.element(card, { timeout: 1000 }).toBeInTheDocument()
    const rect = card.element().getBoundingClientRect()
    expect(rect.left).toBeGreaterThanOrEqual(7)
    expect(rect.top).toBeGreaterThanOrEqual(7)
    expect(rect.right).toBeLessThanOrEqual(window.innerWidth - 7)
    expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight - 7)
  })
})
